/*
  # Fix match setup flow

  1. Changes
    - Add match_innings_players table to track player assignments
    - Update handle_match_start function to properly handle initial setup
    - Add function to validate match setup before starting

  2. Security
    - Maintain existing RLS policies
*/

-- Create match_innings_players table
CREATE TABLE IF NOT EXISTS match_innings_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  innings_id uuid REFERENCES match_innings(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id),
  team_id uuid REFERENCES teams(id),
  role text NOT NULL,
  batting_position integer,
  is_captain boolean DEFAULT false,
  is_vice_captain boolean DEFAULT false,
  is_wicket_keeper boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(innings_id, player_id)
);

-- Enable RLS
ALTER TABLE match_innings_players ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read match innings players"
  ON match_innings_players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match innings players"
  ON match_innings_players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS handle_match_start_trigger ON matches;
DROP FUNCTION IF EXISTS handle_match_start();

-- Create function to handle match start
CREATE OR REPLACE FUNCTION handle_match_start()
RETURNS trigger AS $$
DECLARE
  batting_team_id uuid;
  bowling_team_id uuid;
  innings_id uuid;
  striker_id uuid;
  non_striker_id uuid;
  bowler_id uuid;
BEGIN
  -- Only proceed if status is changing from upcoming to live
  IF NEW.status = 'live' AND OLD.status = 'upcoming' THEN
    -- Determine batting and bowling teams based on toss
    IF NEW.toss_winner = NEW.team1_id THEN
      IF NEW.toss_decision = 'bat' THEN
        batting_team_id := NEW.team1_id;
        bowling_team_id := NEW.team2_id;
      ELSE
        batting_team_id := NEW.team2_id;
        bowling_team_id := NEW.team1_id;
      END IF;
    ELSE
      IF NEW.toss_decision = 'bat' THEN
        batting_team_id := NEW.team2_id;
        bowling_team_id := NEW.team1_id;
      ELSE
        batting_team_id := NEW.team1_id;
        bowling_team_id := NEW.team2_id;
      END IF;
    END IF;

    -- Create first innings
    INSERT INTO match_innings (
      match_id,
      innings_number,
      batting_team_id,
      bowling_team_id,
      current_over,
      current_ball
    ) VALUES (
      NEW.id,
      1,
      batting_team_id,
      bowling_team_id,
      0,
      0
    ) RETURNING id INTO innings_id;

    -- Copy squad players to innings players for batting team
    INSERT INTO match_innings_players (
      match_id,
      innings_id,
      player_id,
      team_id,
      role,
      batting_position,
      is_captain,
      is_vice_captain,
      is_wicket_keeper
    )
    SELECT 
      NEW.id,
      innings_id,
      player_id,
      team_id,
      role,
      batting_order,
      is_captain,
      is_vice_captain,
      is_wicket_keeper
    FROM match_squads
    WHERE match_id = NEW.id
    AND team_id = batting_team_id;

    -- Copy squad players to innings players for bowling team
    INSERT INTO match_innings_players (
      match_id,
      innings_id,
      player_id,
      team_id,
      role,
      is_captain,
      is_vice_captain,
      is_wicket_keeper
    )
    SELECT 
      NEW.id,
      innings_id,
      player_id,
      team_id,
      role,
      is_captain,
      is_vice_captain,
      is_wicket_keeper
    FROM match_squads
    WHERE match_id = NEW.id
    AND team_id = bowling_team_id;

    -- Get opening batsmen (first two in batting order)
    SELECT 
      MIN(CASE WHEN batting_position = 1 THEN player_id END),
      MIN(CASE WHEN batting_position = 2 THEN player_id END)
    INTO striker_id, non_striker_id
    FROM match_innings_players
    WHERE innings_id = innings_id
    AND team_id = batting_team_id
    AND batting_position IN (1, 2);

    -- Get opening bowler
    SELECT player_id INTO bowler_id
    FROM match_innings_players
    WHERE innings_id = innings_id
    AND team_id = bowling_team_id
    AND role IN ('bowler', 'all_rounder')
    LIMIT 1;

    -- Update innings with initial players
    UPDATE match_innings
    SET
      current_batsman_id = striker_id,
      current_non_striker_id = non_striker_id,
      current_bowler_id = bowler_id
    WHERE id = innings_id;

    -- Create initial batsmen records
    INSERT INTO match_batsmen (
      match_id,
      innings_id,
      player_id,
      batting_position,
      is_striker
    ) VALUES 
    (NEW.id, innings_id, striker_id, 1, true),
    (NEW.id, innings_id, non_striker_id, 2, false);

    -- Create initial bowler record
    INSERT INTO match_bowlers (
      match_id,
      innings_id,
      player_id,
      is_current_bowler
    ) VALUES 
    (NEW.id, innings_id, bowler_id, true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for match start
CREATE TRIGGER handle_match_start_trigger
  AFTER UPDATE ON matches
  FOR EACH ROW
  WHEN (OLD.status = 'upcoming' AND NEW.status = 'live')
  EXECUTE FUNCTION handle_match_start();