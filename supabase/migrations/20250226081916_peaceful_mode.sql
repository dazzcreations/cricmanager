/*
  # Fix innings foreign key constraint and ball handling

  1. Changes
    - Add BEFORE trigger to handle ball validation and innings lookup
    - Update ball handling logic to ensure innings exists
    - Add function to get current innings
*/

-- Create function to get current innings
CREATE OR REPLACE FUNCTION get_current_innings(p_match_id uuid)
RETURNS uuid AS $$
DECLARE
  v_innings_id uuid;
BEGIN
  SELECT id INTO v_innings_id
  FROM match_innings
  WHERE match_id = p_match_id
  AND is_completed = false
  ORDER BY innings_number
  LIMIT 1;

  RETURN v_innings_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle ball validation
CREATE OR REPLACE FUNCTION validate_ball()
RETURNS trigger AS $$
DECLARE
  v_innings_id uuid;
BEGIN
  -- Get current innings if not provided
  IF NEW.innings_id IS NULL AND NEW.match_id IS NOT NULL THEN
    SELECT get_current_innings(NEW.match_id) INTO v_innings_id;
    IF v_innings_id IS NULL THEN
      RAISE EXCEPTION 'No active innings found for match';
    END IF;
    NEW.innings_id := v_innings_id;
  END IF;

  -- Calculate ball validity
  NEW.is_valid_ball := NOT (
    COALESCE((NEW.extras->>'wides')::integer, 0) > 0 OR 
    COALESCE((NEW.extras->>'no_balls')::integer, 0) > 0
  );

  -- Set over and ball number if not provided
  IF NEW.over_number IS NULL OR NEW.ball_number IS NULL THEN
    SELECT 
      current_over,
      CASE 
        WHEN current_ball = 6 THEN 1
        ELSE current_ball + 1
      END,
      CASE 
        WHEN current_ball = 6 THEN current_over + 1
        ELSE current_over
      END
    INTO 
      NEW.ball_number,
      NEW.over_number
    FROM match_innings
    WHERE id = NEW.innings_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create BEFORE trigger for ball validation
CREATE TRIGGER validate_ball_trigger
  BEFORE INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION validate_ball();

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger ON balls;
DROP FUNCTION IF EXISTS update_innings_on_ball();

-- Create function to update innings
CREATE OR REPLACE FUNCTION update_innings_on_ball()
RETURNS trigger AS $$
DECLARE
  total_extras integer;
  is_extra boolean;
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
      current_spell_overs = CASE
        WHEN NEW.ball_number = 6 THEN current_spell_overs + 1
        ELSE current_spell_overs + 0.1
      END,
      current_spell_runs = current_spell_runs + NEW.runs + total_extras,
      current_spell_wickets = CASE
        WHEN NEW.wicket_type IS NOT NULL THEN current_spell_wickets + 1
        ELSE current_spell_wickets
      END,
      spells = CASE
        WHEN NEW.ball_number = 6 THEN 
          spells || jsonb_build_object(
            'overs', current_spell_overs + 1,
            'runs', current_spell_runs + NEW.runs + total_extras,
            'wickets', CASE
              WHEN NEW.wicket_type IS NOT NULL THEN current_spell_wickets + 1
              ELSE current_spell_wickets
            END
          )
        ELSE spells
      END
    WHERE 
      innings_id = NEW.innings_id 
      AND player_id = NEW.bowler_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create AFTER trigger for innings updates
CREATE TRIGGER update_innings_on_ball_trigger
  AFTER INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_innings_on_ball();