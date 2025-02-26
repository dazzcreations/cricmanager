/*
  # Add match squads table
  
  1. New Tables
    - `match_squads`: Stores player assignments for each match
      - `id` (uuid, primary key)
      - `match_id` (uuid, references matches)
      - `team_id` (uuid, references teams)
      - `player_id` (uuid, references players)
      - `is_captain` (boolean)
      - `is_vice_captain` (boolean)
      - `is_wicket_keeper` (boolean)
      - `role` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `match_squads` table
    - Add policies for public read access
    - Add policies for scorer/admin write access
*/

-- Create match squads table
CREATE TABLE IF NOT EXISTS match_squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  is_captain boolean DEFAULT false,
  is_vice_captain boolean DEFAULT false,
  is_wicket_keeper boolean DEFAULT false,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure a player can only be in one team per match
  UNIQUE(match_id, player_id)
);

-- Enable RLS
ALTER TABLE match_squads ENABLE ROW LEVEL SECURITY;

-- Policies for match squads
CREATE POLICY "Anyone can read match squads"
  ON match_squads
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match squads"
  ON match_squads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Function to validate match squad assignments
CREATE OR REPLACE FUNCTION validate_match_squad_assignments()
RETURNS trigger AS $$
BEGIN
  -- Ensure only one captain per team in a match
  IF NEW.is_captain THEN
    UPDATE match_squads
    SET is_captain = false
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
    AND id != NEW.id;
  END IF;

  -- Ensure only one vice captain per team in a match
  IF NEW.is_vice_captain THEN
    UPDATE match_squads
    SET is_vice_captain = false
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
    AND id != NEW.id;
  END IF;

  -- Ensure only one wicket keeper per team in a match
  IF NEW.is_wicket_keeper THEN
    UPDATE match_squads
    SET is_wicket_keeper = false
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
    AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
CREATE TRIGGER validate_match_squad_assignments_trigger
  BEFORE INSERT OR UPDATE ON match_squads
  FOR EACH ROW
  EXECUTE FUNCTION validate_match_squad_assignments();