/*
  # Add match_id column to balls table

  1. Changes
    - Add match_id column to balls table
    - Add foreign key constraint
    - Add index for better performance
    - Update existing triggers to handle the new column
*/

-- Add match_id column to balls table
ALTER TABLE balls
ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES matches(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_balls_match_id ON balls(match_id);

-- Update function to handle ball validation
CREATE OR REPLACE FUNCTION update_innings_on_ball()
RETURNS trigger AS $$
DECLARE
  total_extras integer;
  is_extra boolean;
BEGIN
  -- Set match_id from innings
  NEW.match_id := (
    SELECT match_id 
    FROM match_innings 
    WHERE id = NEW.innings_id
  );

  -- Calculate total extras
  total_extras := (
    COALESCE((NEW.extras->>'wides')::integer, 0) +
    COALESCE((NEW.extras->>'no_balls')::integer, 0) +
    COALESCE((NEW.extras->>'byes')::integer, 0) +
    COALESCE((NEW.extras->>'leg_byes')::integer, 0)
  );

  -- Check if ball is an extra
  is_extra := total_extras > 0;

  -- Set is_valid_ball based on extras
  NEW.is_valid_ball := NOT (
    COALESCE((NEW.extras->>'wides')::integer, 0) > 0 OR 
    COALESCE((NEW.extras->>'no_balls')::integer, 0) > 0
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