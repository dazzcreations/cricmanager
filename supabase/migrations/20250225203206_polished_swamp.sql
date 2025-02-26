-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger ON balls;
DROP TRIGGER IF EXISTS update_match_statistics_trigger ON balls;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_innings_on_ball();
DROP FUNCTION IF EXISTS update_match_statistics();

-- Modify match_batsmen table to clarify relationships
ALTER TABLE match_batsmen
  RENAME COLUMN bowler_id TO dismissal_bowler_id;

-- Create explicit foreign key relationships
ALTER TABLE match_batsmen
  DROP CONSTRAINT IF EXISTS match_batsmen_bowler_id_fkey,
  ADD CONSTRAINT match_batsmen_dismissal_bowler_id_fkey 
    FOREIGN KEY (dismissal_bowler_id) 
    REFERENCES players(id);

-- Function to update innings on ball completion
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

  -- Check if ball is an extra
  is_extra := total_extras > 0;

  -- Update innings totals
  UPDATE match_innings
  SET
    total_runs = total_runs + NEW.runs + total_extras,
    total_wickets = CASE 
      WHEN NEW.wicket_type IS NOT NULL THEN total_wickets + 1 
      ELSE total_wickets 
    END,
    overs = CASE
      WHEN NOT is_extra AND NEW.ball_number = 6 THEN current_over + 1
      WHEN NOT is_extra THEN current_over + (NEW.ball_number::numeric / 10)
      ELSE overs
    END,
    current_over = CASE
      WHEN NOT is_extra AND NEW.ball_number = 6 THEN current_over + 1
      ELSE current_over
    END,
    current_ball = CASE
      WHEN NOT is_extra AND NEW.ball_number = 6 THEN 0
      WHEN NOT is_extra THEN NEW.ball_number
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
  IF NOT is_extra AND NEW.bowler_id IS NOT NULL THEN
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

-- Create trigger for innings updates
CREATE TRIGGER update_innings_on_ball_trigger
  AFTER INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_innings_on_ball();

-- Function to update match statistics
CREATE OR REPLACE FUNCTION update_match_statistics()
RETURNS trigger AS $$
BEGIN
  -- Update batsman statistics
  UPDATE match_batsmen
  SET 
    runs_scored = runs_scored + NEW.runs,
    balls_faced = balls_faced + 1,
    fours = CASE WHEN NEW.runs = 4 THEN fours + 1 ELSE fours END,
    sixes = CASE WHEN NEW.runs = 6 THEN sixes + 1 ELSE sixes END,
    strike_rate = CASE 
      WHEN balls_faced + 1 > 0 
      THEN ((runs_scored + NEW.runs)::numeric / (balls_faced + 1)) * 100 
      ELSE 0 
    END
  WHERE 
    innings_id = NEW.innings_id 
    AND player_id = NEW.batsman_id;

  -- Update bowler statistics
  UPDATE match_bowlers
  SET
    runs_conceded = runs_conceded + NEW.runs + COALESCE((NEW.extras->>'wides')::integer, 0) + COALESCE((NEW.extras->>'no_balls')::integer, 0),
    wickets = CASE WHEN NEW.wicket_type IS NOT NULL THEN wickets + 1 ELSE wickets END,
    wides = wides + COALESCE((NEW.extras->>'wides')::integer, 0),
    no_balls = no_balls + COALESCE((NEW.extras->>'no_balls')::integer, 0),
    economy_rate = CASE 
      WHEN overs > 0 
      THEN (runs_conceded::numeric / overs) 
      ELSE 0 
    END
  WHERE 
    innings_id = NEW.innings_id 
    AND player_id = NEW.bowler_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for statistics updates
CREATE TRIGGER update_match_statistics_trigger
  AFTER INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_match_statistics();