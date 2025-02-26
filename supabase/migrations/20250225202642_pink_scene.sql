/*
  # Ball Tracking Schema

  1. New Tables
    - `balls` - Stores ball-by-ball information
    - `ball_events` - Tracks special events for each ball

  2. Changes
    - Add new columns to `match_innings` for current over tracking
    - Add new columns to `match_bowlers` for spell tracking

  3. Security
    - Enable RLS on all new tables
    - Add policies for scorers and admins
*/

-- Create ball tracking table
CREATE TABLE IF NOT EXISTS balls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  innings_id uuid REFERENCES match_innings(id) ON DELETE CASCADE,
  over_number integer NOT NULL,
  ball_number integer NOT NULL CHECK (ball_number BETWEEN 1 AND 6),
  batsman_id uuid REFERENCES players(id),
  bowler_id uuid REFERENCES players(id),
  runs integer DEFAULT 0,
  extras jsonb DEFAULT '{"wides": 0, "no_balls": 0, "byes": 0, "leg_byes": 0}'::jsonb,
  wicket_type text,
  fielder_id uuid REFERENCES players(id),
  ball_speed numeric(4,1),
  pitch_position jsonb,
  shot_type text,
  shot_outcome text,
  is_valid_ball boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(innings_id, over_number, ball_number)
);

-- Create ball events table
CREATE TABLE IF NOT EXISTS ball_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ball_id uuid REFERENCES balls(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add current over tracking to match_innings
DO $$ 
BEGIN
  ALTER TABLE match_innings
    ADD COLUMN IF NOT EXISTS current_over integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_ball integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_bowler_id uuid REFERENCES players(id),
    ADD COLUMN IF NOT EXISTS current_batsman_id uuid REFERENCES players(id),
    ADD COLUMN IF NOT EXISTS current_non_striker_id uuid REFERENCES players(id);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add spell tracking to match_bowlers
DO $$ 
BEGIN
  ALTER TABLE match_bowlers
    ADD COLUMN IF NOT EXISTS current_spell_overs numeric(4,1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_spell_runs integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_spell_wickets integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS spells jsonb DEFAULT '[]';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE balls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ball_events ENABLE ROW LEVEL SECURITY;

-- Create policies for balls
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Public can read balls" ON balls;
  DROP POLICY IF EXISTS "Scorers and admins can manage balls" ON balls;
  
  CREATE POLICY "Public can read balls"
    ON balls FOR SELECT
    TO public
    USING (true);

  CREATE POLICY "Scorers and admins can manage balls"
    ON balls FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('scorer', 'admin', 'super_admin')
      )
    );
END $$;

-- Create policies for ball events
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Public can read ball events" ON ball_events;
  DROP POLICY IF EXISTS "Scorers and admins can manage ball events" ON ball_events;
  
  CREATE POLICY "Public can read ball events"
    ON ball_events FOR SELECT
    TO public
    USING (true);

  CREATE POLICY "Scorers and admins can manage ball events"
    ON ball_events FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('scorer', 'admin', 'super_admin')
      )
    );
END $$;

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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_innings_on_ball_trigger ON balls;

-- Create trigger for innings updates
CREATE TRIGGER update_innings_on_ball_trigger
  AFTER INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_innings_on_ball();