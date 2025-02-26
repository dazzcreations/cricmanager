/*
  # Tournament Player Mapping

  1. New Tables
    - `tournament_team_players`
      - Maps players to teams specifically for tournaments
      - Ensures a player can only be in one team per tournament
      - Tracks tournament-specific details like jersey numbers

  2. Changes
    - Added unique constraint to prevent duplicate player assignments in a tournament
    - Added trigger to validate player assignments

  3. Security
    - Enabled RLS
    - Added policies for read/write access
*/

-- Create tournament team players table
CREATE TABLE IF NOT EXISTS tournament_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  jersey_number integer,
  role text NOT NULL DEFAULT 'player',
  is_captain boolean DEFAULT false,
  is_vice_captain boolean DEFAULT false,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure a player can only be in one team per tournament
  UNIQUE(tournament_id, player_id),
  -- Ensure jersey numbers are unique within a team for a tournament
  UNIQUE(tournament_id, team_id, jersey_number)
);

-- Enable RLS
ALTER TABLE tournament_team_players ENABLE ROW LEVEL SECURITY;

-- Policies for tournament_team_players
CREATE POLICY "Anyone can read tournament team players"
  ON tournament_team_players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Super admins and admins can manage tournament team players"
  ON tournament_team_players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Function to validate tournament player assignment
CREATE OR REPLACE FUNCTION validate_tournament_player_assignment()
RETURNS trigger AS $$
BEGIN
  -- Check if the team is part of the tournament
  IF NOT EXISTS (
    SELECT 1 FROM tournament_teams
    WHERE tournament_id = NEW.tournament_id
    AND team_id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'Team is not part of this tournament';
  END IF;

  -- Check if the player is part of the team's general squad
  IF NOT EXISTS (
    SELECT 1 FROM team_players
    WHERE team_id = NEW.team_id
    AND player_id = NEW.player_id
  ) THEN
    RAISE EXCEPTION 'Player is not part of this team''s squad';
  END IF;

  -- Ensure only one captain per team in a tournament
  IF NEW.is_captain THEN
    UPDATE tournament_team_players
    SET is_captain = false
    WHERE tournament_id = NEW.tournament_id
    AND team_id = NEW.team_id
    AND id != NEW.id;
  END IF;

  -- Ensure only one vice captain per team in a tournament
  IF NEW.is_vice_captain THEN
    UPDATE tournament_team_players
    SET is_vice_captain = false
    WHERE tournament_id = NEW.tournament_id
    AND team_id = NEW.team_id
    AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
CREATE TRIGGER validate_tournament_player_assignment_trigger
  BEFORE INSERT OR UPDATE ON tournament_team_players
  FOR EACH ROW
  EXECUTE FUNCTION validate_tournament_player_assignment();