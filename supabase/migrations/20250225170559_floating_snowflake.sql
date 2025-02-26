/*
  # Player and Team Management Schema

  1. New Tables
    - `player_profiles`
      - Basic player information
      - Professional details
      - Career statistics
      - Status tracking
    
    - `team_profiles`
      - Team information
      - Squad management
      - Performance tracking
    
    - `team_players`
      - Player-team relationships
      - Role assignments
      - Squad position tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
*/

-- Player profile extensions
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS jersey_number integer,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS career_stats jsonb DEFAULT '{
    "matches": 0,
    "runs": 0,
    "wickets": 0,
    "catches": 0,
    "highest_score": 0,
    "best_bowling": null
  }'::jsonb;

-- Team profile extensions
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS home_ground text,
  ADD COLUMN IF NOT EXISTS founded_year integer,
  ADD COLUMN IF NOT EXISTS team_stats jsonb DEFAULT '{
    "matches_played": 0,
    "matches_won": 0,
    "matches_lost": 0,
    "matches_drawn": 0
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS max_squad_size integer DEFAULT 25;

-- Team players junction table
CREATE TABLE IF NOT EXISTS team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'player',
  jersey_number integer,
  is_captain boolean DEFAULT false,
  is_vice_captain boolean DEFAULT false,
  joined_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, player_id),
  UNIQUE(team_id, jersey_number)
);

-- Enable RLS
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

-- Policies for team_players
CREATE POLICY "Anyone can read team players"
  ON team_players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Super admins and admins can manage team players"
  ON team_players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Function to validate squad size
CREATE OR REPLACE FUNCTION check_squad_size()
RETURNS trigger AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM team_players
    WHERE team_id = NEW.team_id
    AND status = 'active'
  ) >= (
    SELECT max_squad_size
    FROM teams
    WHERE id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'Maximum squad size reached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check squad size before adding new player
CREATE TRIGGER check_squad_size_trigger
  BEFORE INSERT ON team_players
  FOR EACH ROW
  EXECUTE FUNCTION check_squad_size();

-- Function to ensure only one captain per team
CREATE OR REPLACE FUNCTION ensure_single_captain()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_captain THEN
    UPDATE team_players
    SET is_captain = false
    WHERE team_id = NEW.team_id
    AND id != NEW.id;
  END IF;
  
  IF NEW.is_vice_captain THEN
    UPDATE team_players
    SET is_vice_captain = false
    WHERE team_id = NEW.team_id
    AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure single captain
CREATE TRIGGER ensure_single_captain_trigger
  BEFORE INSERT OR UPDATE ON team_players
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_captain();