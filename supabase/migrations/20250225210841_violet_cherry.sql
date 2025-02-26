/*
  # Fix match setup flow

  1. Changes
    - Add batting_order column to match_squads
    - Update handle_match_start function to properly handle initial setup
    - Add function to validate match setup before starting

  2. Security
    - Maintain existing RLS policies
*/

-- Add batting_order to match_squads
ALTER TABLE match_squads
ADD COLUMN IF NOT EXISTS batting_order integer;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS handle_match_start_trigger ON matches;
DROP FUNCTION IF EXISTS handle_match_start();

-- Create function to validate match setup
CREATE OR REPLACE FUNCTION validate_match_setup(match_id uuid)
RETURNS boolean AS $$
DECLARE
  team1_players integer;
  team2_players integer;
  team1_captain integer;
  team2_captain integer;
  team1_wicket_keeper integer;
  team2_wicket_keeper integer;
BEGIN
  -- Check team 1 players
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE is_captain = true),
         COUNT(*) FILTER (WHERE is_wicket_keeper = true)
  INTO team1_players, team1_captain, team1_wicket_keeper
  FROM match_squads
  WHERE match_id = match_id
  AND team_id = (SELECT team1_id FROM matches WHERE id = match_id);

  -- Check team 2 players
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE is_captain = true),
         COUNT(*) FILTER (WHERE is_wicket_keeper = true)
  INTO team2_players, team2_captain, team2_wicket_keeper
  FROM match_squads
  WHERE match_id = match_id
  AND team_id = (SELECT team2_id FROM matches WHERE id = match_id);

  -- Validate requirements
  RETURN team1_players = 11 
    AND team2_players = 11 
    AND team1_captain = 1 
    AND team2_captain = 1
    AND team1_wicket_keeper = 1
    AND team2_wicket_keeper = 1;
END;
$$ LANGUAGE plpgsql;

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
  -- Validate match setup
  IF NOT validate_match_setup(NEW.id) THEN
    RAISE EXCEPTION 'Invalid match setup. Please ensure both teams have 11 players with captain and wicket keeper assigned.';
  END IF;

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

    -- Get opening batsmen from batting team (first two in batting order)
    SELECT 
      MIN(CASE WHEN batting_order = 1 THEN player_id END) as striker,
      MIN(CASE WHEN batting_order = 2 THEN player_id END) as non_striker
    INTO striker_id, non_striker_id
    FROM match_squads
    WHERE match_id = NEW.id 
    AND team_id = batting_team_id
    AND batting_order IN (1, 2);

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

-- Function to update match_squads batting order
CREATE OR REPLACE FUNCTION update_batting_order()
RETURNS trigger AS $$
BEGIN
  -- Update batting order for the team
  UPDATE match_squads
  SET batting_order = sq.new_order
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY team_id 
        ORDER BY 
          CASE 
            WHEN role = 'batsman' THEN 1
            WHEN role = 'wicket_keeper' THEN 2
            WHEN role = 'all_rounder' THEN 3
            ELSE 4
          END,
          player_id
      ) as new_order
    FROM match_squads
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
  ) sq
  WHERE match_squads.id = sq.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for batting order updates
CREATE TRIGGER update_batting_order_trigger
  AFTER INSERT ON match_squads
  FOR EACH ROW
  EXECUTE FUNCTION update_batting_order();