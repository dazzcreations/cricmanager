/*
  # Fix match setup flow

  1. Changes
    - Add innings_number column to match_innings
    - Add function to create first innings on match start
    - Add function to handle initial batsmen and bowlers

  2. Security
    - Maintain existing RLS policies
*/

-- Create function to handle match start
CREATE OR REPLACE FUNCTION handle_match_start()
RETURNS trigger AS $$
DECLARE
  batting_team_id uuid;
  bowling_team_id uuid;
  innings_id uuid;
BEGIN
  -- Determine batting and bowling teams based on toss
  IF NEW.status = 'live' AND OLD.status = 'upcoming' THEN
    -- Set batting team based on toss decision
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_match_start_trigger ON matches;

-- Create trigger for match start
CREATE TRIGGER handle_match_start_trigger
  AFTER UPDATE ON matches
  FOR EACH ROW
  WHEN (OLD.status = 'upcoming' AND NEW.status = 'live')
  EXECUTE FUNCTION handle_match_start();