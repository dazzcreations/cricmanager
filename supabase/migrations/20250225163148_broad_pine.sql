/*
  # Add Tournaments Table

  1. New Tables
    - `tournaments`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `start_date` (timestamptz)
      - `end_date` (timestamptz)
      - `location` (text)
      - `team_count` (integer)
      - `status` (enum: upcoming, ongoing, completed)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. New Types
    - `tournament_status` enum

  3. Security
    - Enable RLS on tournaments table
    - Add policies for:
      - Public read access
      - Admin-only write access
*/

-- Create tournament status enum
CREATE TYPE tournament_status AS ENUM ('upcoming', 'ongoing', 'completed');

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  location text NOT NULL,
  team_count integer DEFAULT 0,
  status tournament_status NOT NULL DEFAULT 'upcoming',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read tournaments"
  ON tournaments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage tournaments"
  ON tournaments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create tournament_teams junction table
CREATE TABLE IF NOT EXISTS tournament_teams (
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (tournament_id, team_id)
);

-- Enable RLS on tournament_teams
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

-- Policies for tournament_teams
CREATE POLICY "Anyone can read tournament teams"
  ON tournament_teams
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage tournament teams"
  ON tournament_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update team count
CREATE OR REPLACE FUNCTION update_tournament_team_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tournaments
    SET team_count = team_count + 1,
        updated_at = now()
    WHERE id = NEW.tournament_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tournaments
    SET team_count = team_count - 1,
        updated_at = now()
    WHERE id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update team count
CREATE TRIGGER update_tournament_team_count_trigger
  AFTER INSERT OR DELETE ON tournament_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_team_count();