/*
  # Fix Match Start Function

  1. Changes
    - Fix MIN aggregate function usage with UUIDs
    - Improve player selection logic
    - Add better error handling
    - Clean up existing records before creating new ones

  2. Functions Modified
    - handle_match_start
    - validate_match_setup
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS handle_match_start_trigger ON matches;
DROP FUNCTION IF EXISTS handle_match_start();
DROP FUNCTION IF EXISTS validate_match_setup(uuid);

-- Create function to validate match setup
CREATE OR REPLACE FUNCTION validate_match_setup(p_match_id uuid)
RETURNS boolean AS $$
DECLARE
  v_team1_id uuid;
  v_team2_id uuid;
  team1_players integer;
  team2_players integer;
  team1_captain integer;
  team2_captain integer;
  team1_wicket_keeper integer;
  team2_wicket_keeper integer;
BEGIN
  -- Get team IDs
  SELECT team1_id, team2_id 
  INTO v_team1_id, v_team2_id 
  FROM matches 
  WHERE id = p_match_id;

  -- Check team 1 players
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE is_captain = true),
         COUNT(*) FILTER (WHERE is_wicket_keeper = true)
  INTO team1_players, team1_captain, team1_wicket_keeper
  FROM match_squads
  WHERE match_id = p_match_id
  AND team_id = v_team1_id;

  -- Check team 2 players
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE is_captain = true),
         COUNT(*) FILTER (WHERE is_wicket_keeper = true)
  INTO team2_players, team2_captain, team2_wicket_keeper
  FROM match_squads
  WHERE match_id = p_match_id
  AND team_id = v_team2_id;

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
  v_squad_record RECORD;
BEGIN
  -- Only proceed if status is changing from upcoming to live
  IF NEW.status = 'live' AND OLD.status = 'upcoming' THEN
    -- Validate match setup
    IF NOT validate_match_setup(NEW.id) THEN
      RAISE EXCEPTION 'Invalid match setup. Please ensure both teams have 11 players with captain and wicket keeper assigned.';
    END IF;

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

    -- Clean up any existing innings and related records
    DELETE FROM match_bowlers WHERE match_id = NEW.id;
    DELETE FROM match_batsmen WHERE match_id = NEW.id;
    DELETE FROM match_innings WHERE match_id = NEW.id;

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

    -- Get opening batsmen (first two in batting order)
    SELECT 
      player_id INTO striker_id
    FROM match_squads
    WHERE match_id = NEW.id
    AND team_id = batting_team_id
    AND batting_order = 1
    LIMIT 1;

    SELECT 
      player_id INTO non_striker_id
    FROM match_squads
    WHERE match_id = NEW.id
    AND team_id = batting_team_id
    AND batting_order = 2
    LIMIT 1;

    -- Get opening bowler
    SELECT player_id INTO bowler_id
    FROM match_squads
    WHERE match_id = NEW.id
    AND team_id = bowling_team_id
    AND role IN ('bowler', 'all_rounder')
    LIMIT 1;

    -- Validate required players are found
    IF striker_id IS NULL OR non_striker_id IS NULL OR bowler_id IS NULL THEN
      RAISE EXCEPTION 'Failed to find required players for match start';
    END IF;

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

-- Add unique constraint to match_squads
ALTER TABLE match_squads
  DROP CONSTRAINT IF EXISTS match_squads_match_id_player_id_key,
  ADD CONSTRAINT match_squads_match_id_player_id_key 
    UNIQUE (match_id, player_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_match_squads_match_team
  ON match_squads (match_id, team_id);