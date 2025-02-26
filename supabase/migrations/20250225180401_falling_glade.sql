/*
  # Tournament Management System

  1. New Tables
    - tournament_formats
    - tournament_rules
    - tournament_prizes
    - tournament_matches
    - tournament_standings

  2. Changes
    - Add new columns to tournaments table
    - Add tournament format and rules support
    - Add prize pool tracking
    - Add tournament progress tracking

  3. Security
    - Enable RLS on all new tables
    - Add policies for tournament management
*/

-- Create tournament format enum
CREATE TYPE tournament_format AS ENUM (
  'single_elimination',
  'double_elimination',
  'round_robin',
  'league',
  'group_stage_knockout'
);

-- Create tournament stage enum
CREATE TYPE tournament_stage AS ENUM (
  'group_stage',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final'
);

-- Add new columns to tournaments table
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS format tournament_format NOT NULL DEFAULT 'single_elimination',
  ADD COLUMN IF NOT EXISTS rules jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prize_pool jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS game_type text,
  ADD COLUMN IF NOT EXISTS min_teams integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_teams integer,
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_stage tournament_stage,
  ADD COLUMN IF NOT EXISTS progress jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

-- Create tournament rules table
CREATE TABLE IF NOT EXISTS tournament_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tournament prizes table
CREATE TABLE IF NOT EXISTS tournament_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  position integer NOT NULL,
  prize_type text NOT NULL,
  amount numeric,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, position)
);

-- Create tournament matches table
CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  stage tournament_stage,
  round integer,
  match_number integer,
  scheduled_time timestamptz,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, stage, round, match_number)
);

-- Create tournament standings table
CREATE TABLE IF NOT EXISTS tournament_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  stage tournament_stage,
  position integer,
  points integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  matches_won integer DEFAULT 0,
  matches_lost integer DEFAULT 0,
  matches_drawn integer DEFAULT 0,
  net_run_rate numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, team_id, stage)
);

-- Enable RLS
ALTER TABLE tournament_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_standings ENABLE ROW LEVEL SECURITY;

-- Policies for tournament rules
CREATE POLICY "Anyone can read tournament rules"
  ON tournament_rules
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage tournament rules"
  ON tournament_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Policies for tournament prizes
CREATE POLICY "Anyone can read tournament prizes"
  ON tournament_prizes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage tournament prizes"
  ON tournament_prizes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Policies for tournament matches
CREATE POLICY "Anyone can read tournament matches"
  ON tournament_matches
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage tournament matches"
  ON tournament_matches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Policies for tournament standings
CREATE POLICY "Anyone can read tournament standings"
  ON tournament_standings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage tournament standings"
  ON tournament_standings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Function to update tournament progress
CREATE OR REPLACE FUNCTION update_tournament_progress()
RETURNS trigger AS $$
BEGIN
  WITH match_stats AS (
    SELECT
      COUNT(*) as total_matches,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_matches
    FROM tournament_matches
    WHERE tournament_id = NEW.tournament_id
  )
  UPDATE tournaments
  SET progress = jsonb_build_object(
    'total_matches', match_stats.total_matches,
    'completed_matches', match_stats.completed_matches,
    'completion_percentage', 
    CASE 
      WHEN match_stats.total_matches > 0 
      THEN ROUND((match_stats.completed_matches::float / match_stats.total_matches::float) * 100)
      ELSE 0
    END
  )
  FROM match_stats
  WHERE id = NEW.tournament_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for progress updates
CREATE TRIGGER update_tournament_progress_trigger
  AFTER INSERT OR UPDATE ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_progress();

-- Function to validate tournament settings
CREATE OR REPLACE FUNCTION validate_tournament_settings()
RETURNS trigger AS $$
BEGIN
  -- Validate dates
  IF NEW.start_date >= NEW.end_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  IF NEW.registration_deadline IS NOT NULL AND NEW.registration_deadline > NEW.start_date THEN
    RAISE EXCEPTION 'Registration deadline must be before start date';
  END IF;

  -- Validate team limits
  IF NEW.min_teams < 2 THEN
    RAISE EXCEPTION 'Minimum teams must be at least 2';
  END IF;

  IF NEW.max_teams IS NOT NULL AND NEW.max_teams < NEW.min_teams THEN
    RAISE EXCEPTION 'Maximum teams must be greater than minimum teams';
  END IF;

  -- Format-specific validations
  CASE NEW.format
    WHEN 'single_elimination' THEN
      IF NEW.min_teams < 4 THEN
        RAISE EXCEPTION 'Single elimination tournaments require at least 4 teams';
      END IF;
    WHEN 'double_elimination' THEN
      IF NEW.min_teams < 4 THEN
        RAISE EXCEPTION 'Double elimination tournaments require at least 4 teams';
      END IF;
    WHEN 'round_robin' THEN
      IF NEW.min_teams < 3 THEN
        RAISE EXCEPTION 'Round robin tournaments require at least 3 teams';
      END IF;
    WHEN 'group_stage_knockout' THEN
      IF NEW.min_teams < 8 THEN
        RAISE EXCEPTION 'Group stage knockout tournaments require at least 8 teams';
      END IF;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tournament validation
CREATE TRIGGER validate_tournament_settings_trigger
  BEFORE INSERT OR UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION validate_tournament_settings();