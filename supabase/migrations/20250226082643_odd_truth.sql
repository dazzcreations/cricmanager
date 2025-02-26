/*
  # Fix ball tracking and innings updates

  1. Changes
    - Add is_valid_ball column to balls table
    - Add validation for ball submissions
    - Update ball tracking logic
    - Fix relationship paths for player queries

  2. New Tables
    - None

  3. Modified Tables
    - balls: Add is_valid_ball column and validation
*/

-- Add is_valid_ball column to balls table if it doesn't exist
DO $$ 
BEGIN
  ALTER TABLE balls
    ADD COLUMN IF NOT EXISTS is_valid_ball boolean DEFAULT true;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create function to validate ball submission
CREATE OR REPLACE FUNCTION validate_ball_submission()
RETURNS trigger AS $$
DECLARE
  v_current_over integer;
  v_current_ball integer;
BEGIN
  -- Get current over and ball
  SELECT current_over, current_ball
  INTO v_current_over, v_current_ball
  FROM match_innings
  WHERE id = NEW.innings_id;

  -- Set over and ball number if not provided
  IF NEW.over_number IS NULL THEN
    NEW.over_number := v_current_over;
  END IF;

  IF NEW.ball_number IS NULL THEN
    NEW.ball_number := v_current_ball + 1;
  END IF;

  -- Calculate ball validity
  NEW.is_valid_ball := NOT (
    COALESCE((NEW.extras->>'wides')::integer, 0) > 0 OR 
    COALESCE((NEW.extras->>'no_balls')::integer, 0) > 0
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ball validation
DROP TRIGGER IF EXISTS validate_ball_submission_trigger ON balls;
CREATE TRIGGER validate_ball_submission_trigger
  BEFORE INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION validate_ball_submission();

-- Create function to update innings on ball
CREATE OR REPLACE FUNCTION update_innings_on_ball()
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

-- Drop existing trigger first
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger ON balls;

-- Create trigger for innings updates
CREATE TRIGGER update_innings_on_ball_trigger
  AFTER INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_innings_on_ball();

-- Add constraints to balls table
ALTER TABLE balls
  DROP CONSTRAINT IF EXISTS balls_ball_number_check,
  ADD CONSTRAINT balls_ball_number_check 
    CHECK (ball_number BETWEEN 1 AND 6);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_balls_innings_over_ball 
  ON balls(innings_id, over_number, ball_number);

CREATE INDEX IF NOT EXISTS idx_match_innings_current 
  ON match_innings(current_over, current_ball);