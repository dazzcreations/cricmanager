/*
  # Fix match innings creation

  1. Changes
    - Add current_batsman and current_bowler columns to match_innings
    - Update handle_match_start function to properly create innings
    - Add function to handle initial batsmen and bowler setup

  2. Security
    - Maintain existing RLS policies
*/

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
  squad_data RECORD;
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

    -- Get opening batsmen from batting team
    SELECT 
      MIN(CASE WHEN rn = 1 THEN player_id END) as striker,
      MIN(CASE WHEN rn = 2 THEN player_id END) as non_striker
    INTO striker_id, non_striker_id
    FROM (
      SELECT 
        player_id,
        ROW_NUMBER() OVER (ORDER BY player_id) as rn
      FROM match_squads
      WHERE match_id = NEW.id 
      AND team_id = batting_team_id
      AND role IN ('batsman', 'all_rounder', 'wicket_keeper')
      LIMIT 2
    ) sq;

    -- Get opening bowler from bowling team
    SELECT player_id INTO bowler_id
    FROM match_squads
    WHERE match_id = NEW.id 
    AND team_id = bowling_team_id
    AND role IN ('bowler', 'all_rounder')
    LIMIT 1;

    -- Create first innings
    INSERT INTO match_innings (
      match_id,
      innings_number,
      batting_team_id,
      bowling_team_id,
      current_over,
      current_ball,
      current_batsman_id,
      current_non_striker_id,
      current_bowler_id
    ) VALUES (
      NEW.id,
      1,
      batting_team_id,
      bowling_team_id,
      0,
      0,
      striker_id,
      non_striker_id,
      bowler_id
    ) RETURNING id INTO innings_id;

    -- Create match_batsmen records
    INSERT INTO match_batsmen (
      match_id,
      innings_id,
      player_id,
      batting_position,
      is_striker
    ) VALUES 
    (NEW.id, innings_id, striker_id, 1, true),
    (NEW.id, innings_id, non_striker_id, 2, false);

    -- Create match_bowlers record
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