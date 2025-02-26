/*
  # Fix ball triggers and policies

  1. Changes
    - Drop all existing triggers and functions
    - Create new triggers with proper validation
    - Add proper cleanup of existing policies
    - Fix ball submission validation and update logic
*/

-- Drop all existing triggers first
DROP TRIGGER IF EXISTS validate_ball_submission_trigger ON balls;
DROP TRIGGER IF EXISTS validate_ball_submission_trigger_v2 ON balls;
DROP TRIGGER IF EXISTS validate_ball_submission_trigger_v3 ON balls;
DROP TRIGGER IF EXISTS validate_ball_submission_trigger_v4 ON balls;
DROP TRIGGER IF EXISTS validate_ball_submission_trigger_v5 ON balls;
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger ON balls;
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger_v2 ON balls;
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger_v3 ON balls;
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger_v4 ON balls;
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger_v5 ON balls;

-- Drop all existing functions
DROP FUNCTION IF EXISTS validate_ball_submission();
DROP FUNCTION IF EXISTS validate_ball_submission_v2();
DROP FUNCTION IF EXISTS validate_ball_submission_v3();
DROP FUNCTION IF EXISTS validate_ball_submission_v4();
DROP FUNCTION IF EXISTS validate_ball_submission_v5();
DROP FUNCTION IF EXISTS update_innings_on_ball();
DROP FUNCTION IF EXISTS update_innings_on_ball_v2();
DROP FUNCTION IF EXISTS update_innings_on_ball_v3();
DROP FUNCTION IF EXISTS update_innings_on_ball_v4();
DROP FUNCTION IF EXISTS update_innings_on_ball_v5();

-- Drop all existing policies
DROP POLICY IF EXISTS "balls_read_policy" ON balls;
DROP POLICY IF EXISTS "balls_write_policy" ON balls;
DROP POLICY IF EXISTS "balls_read_policy_v2" ON balls;
DROP POLICY IF EXISTS "balls_write_policy_v2" ON balls;
DROP POLICY IF EXISTS "balls_read_policy_v3" ON balls;
DROP POLICY IF EXISTS "balls_write_policy_v3" ON balls;
DROP POLICY IF EXISTS "balls_read_policy_v4" ON balls;
DROP POLICY IF EXISTS "balls_write_policy_v4" ON balls;
DROP POLICY IF EXISTS "balls_read_policy_v5" ON balls;
DROP POLICY IF EXISTS "balls_write_policy_v5" ON balls;

-- Create function to validate ball submission
CREATE OR REPLACE FUNCTION validate_ball_submission_final()
RETURNS trigger AS $$
DECLARE
  v_innings RECORD;
BEGIN
  -- Check if innings exists and get current state
  SELECT * INTO v_innings
  FROM match_innings
  WHERE id = NEW.innings_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Innings with ID % does not exist', NEW.innings_id;
  END IF;

  -- Set match_id from innings
  NEW.match_id := v_innings.match_id;

  -- Set over and ball number if not provided
  IF NEW.over_number IS NULL THEN
    NEW.over_number := v_innings.current_over;
  END IF;

  IF NEW.ball_number IS NULL THEN
    NEW.ball_number := CASE 
      WHEN v_innings.current_ball = 6 THEN 1
      ELSE v_innings.current_ball + 1
    END;
  END IF;

  -- Calculate ball validity
  NEW.is_valid_ball := NOT (
    COALESCE((NEW.extras->>'wides')::integer, 0) > 0 OR 
    COALESCE((NEW.extras->>'no_balls')::integer, 0) > 0
  );

  -- Validate required fields
  IF NEW.batsman_id IS NULL THEN
    NEW.batsman_id := v_innings.current_batsman_id;
  END IF;

  IF NEW.bowler_id IS NULL THEN
    NEW.bowler_id := v_innings.current_bowler_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update innings on ball
CREATE OR REPLACE FUNCTION update_innings_on_ball_final()
RETURNS trigger AS $$
DECLARE
  total_extras integer;
BEGIN
  -- Calculate total extras
  total_extras := (
    COALESCE((NEW.extras->>'wides')::integer, 0) +
    COALESCE((NEW.extras->>'no_balls')::integer, 0) +
    COALESCE((NEW.extras->>'byes')::integer, 0) +
    COALESCE((NEW.extras->>'leg_byes')::integer, 0)
  );

  -- Update innings totals
  UPDATE match_innings
  SET
    total_runs = total_runs + NEW.runs + total_extras,
    total_wickets = CASE 
      WHEN NEW.wicket_type IS NOT NULL THEN total_wickets + 1 
      ELSE total_wickets 
    END,
    overs = CASE
      WHEN NEW.is_valid_ball AND NEW.ball_number = 6 THEN current_over + 1
      WHEN NEW.is_valid_ball THEN current_over + (NEW.ball_number::numeric / 10)
      ELSE overs
    END,
    current_over = CASE
      WHEN NEW.is_valid_ball AND NEW.ball_number = 6 THEN current_over + 1
      ELSE current_over
    END,
    current_ball = CASE
      WHEN NEW.is_valid_ball AND NEW.ball_number = 6 THEN 0
      WHEN NEW.is_valid_ball THEN NEW.ball_number
      ELSE current_ball
    END,
    extras = jsonb_set(
      extras,
      '{wides}',
      to_jsonb(COALESCE((extras->>'wides')::integer, 0) + COALESCE((NEW.extras->>'wides')::integer, 0))
    ) #> '{}'::text[] ||
    jsonb_set(
      extras,
      '{no_balls}',
      to_jsonb(COALESCE((extras->>'no_balls')::integer, 0) + COALESCE((NEW.extras->>'no_balls')::integer, 0))
    ) #> '{}'::text[] ||
    jsonb_set(
      extras,
      '{byes}',
      to_jsonb(COALESCE((extras->>'byes')::integer, 0) + COALESCE((NEW.extras->>'byes')::integer, 0))
    ) #> '{}'::text[] ||
    jsonb_set(
      extras,
      '{leg_byes}',
      to_jsonb(COALESCE((extras->>'leg_byes')::integer, 0) + COALESCE((NEW.extras->>'leg_byes')::integer, 0))
    ) #> '{}'::text[],
    current_run_rate = CASE
      WHEN overs > 0 THEN (total_runs::numeric / overs)
      ELSE 0
    END,
    updated_at = now()
  WHERE id = NEW.innings_id;

  -- Update bowler's spell
  IF NEW.is_valid_ball AND NEW.bowler_id IS NOT NULL THEN
    UPDATE match_bowlers
    SET
      overs = CASE
        WHEN NEW.ball_number = 6 THEN overs + 1
        ELSE overs + 0.1
      END,
      runs_conceded = runs_conceded + NEW.runs + total_extras,
      wickets = CASE
        WHEN NEW.wicket_type IS NOT NULL THEN wickets + 1
        ELSE wickets
      END,
      economy_rate = CASE
        WHEN overs > 0 THEN (runs_conceded::numeric / overs)
        ELSE 0
      END
    WHERE 
      innings_id = NEW.innings_id 
      AND player_id = NEW.bowler_id;
  END IF;

  -- Update batsman statistics
  IF NEW.batsman_id IS NOT NULL THEN
    UPDATE match_batsmen
    SET
      runs_scored = runs_scored + NEW.runs,
      balls_faced = CASE
        WHEN NEW.is_valid_ball THEN balls_faced + 1
        ELSE balls_faced
      END,
      strike_rate = CASE
        WHEN balls_faced > 0 THEN (runs_scored::numeric / balls_faced) * 100
        ELSE 0
      END
    WHERE
      innings_id = NEW.innings_id
      AND player_id = NEW.batsman_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers with final names
CREATE TRIGGER validate_ball_submission_trigger_final
  BEFORE INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION validate_ball_submission_final();

CREATE TRIGGER update_innings_on_ball_trigger_final
  AFTER INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_innings_on_ball_final();

-- Create policies with final names
CREATE POLICY "balls_read_policy_final"
  ON balls FOR SELECT
  TO public
  USING (true);

CREATE POLICY "balls_write_policy_final"
  ON balls FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_balls_match_id ON balls(match_id);
CREATE INDEX IF NOT EXISTS idx_balls_innings_id ON balls(innings_id);
CREATE INDEX IF NOT EXISTS idx_balls_over_ball ON balls(over_number, ball_number);
CREATE INDEX IF NOT EXISTS idx_match_innings_match_id ON match_innings(match_id);
CREATE INDEX IF NOT EXISTS idx_match_innings_current ON match_innings(current_over, current_ball);