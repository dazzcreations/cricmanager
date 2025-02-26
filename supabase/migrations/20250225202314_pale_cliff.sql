/*
  # Match Setup Schema

  1. New Tables
    - `match_innings` - Stores innings details
    - `match_batsmen` - Tracks current and completed batting performances
    - `match_bowlers` - Tracks current and completed bowling performances
    - `match_partnerships` - Records batting partnerships
    - `match_stats` - Stores live match statistics

  2. Changes
    - Add new columns to `matches` table for match state
    - Add new columns to `match_squads` for player roles

  3. Security
    - Enable RLS on all new tables
    - Add policies for scorers and admins
*/

-- Create match innings table
CREATE TABLE IF NOT EXISTS match_innings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  innings_number integer NOT NULL,
  batting_team_id uuid REFERENCES teams(id),
  bowling_team_id uuid REFERENCES teams(id),
  total_runs integer DEFAULT 0,
  total_wickets integer DEFAULT 0,
  overs numeric(4,1) DEFAULT 0,
  extras jsonb DEFAULT '{"wides": 0, "no_balls": 0, "byes": 0, "leg_byes": 0}'::jsonb,
  target integer,
  required_run_rate numeric(4,2),
  current_run_rate numeric(4,2) DEFAULT 0,
  projected_score integer,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(match_id, innings_number)
);

-- Create match batsmen table
CREATE TABLE IF NOT EXISTS match_batsmen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  innings_id uuid REFERENCES match_innings(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id),
  batting_position integer,
  runs_scored integer DEFAULT 0,
  balls_faced integer DEFAULT 0,
  fours integer DEFAULT 0,
  sixes integer DEFAULT 0,
  strike_rate numeric(6,2) DEFAULT 0,
  is_out boolean DEFAULT false,
  dismissal_type text,
  bowler_id uuid REFERENCES players(id),
  fielder_id uuid REFERENCES players(id),
  is_striker boolean DEFAULT false,
  is_retired_hurt boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(innings_id, player_id)
);

-- Create match bowlers table
CREATE TABLE IF NOT EXISTS match_bowlers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  innings_id uuid REFERENCES match_innings(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id),
  overs numeric(4,1) DEFAULT 0,
  maidens integer DEFAULT 0,
  runs_conceded integer DEFAULT 0,
  wickets integer DEFAULT 0,
  wides integer DEFAULT 0,
  no_balls integer DEFAULT 0,
  economy_rate numeric(4,2) DEFAULT 0,
  is_current_bowler boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(innings_id, player_id)
);

-- Create match partnerships table
CREATE TABLE IF NOT EXISTS match_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  innings_id uuid REFERENCES match_innings(id) ON DELETE CASCADE,
  batsman1_id uuid REFERENCES players(id),
  batsman2_id uuid REFERENCES players(id),
  partnership_runs integer DEFAULT 0,
  partnership_balls integer DEFAULT 0,
  is_current boolean DEFAULT false,
  wicket_at integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create match stats table
CREATE TABLE IF NOT EXISTS match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  innings_id uuid REFERENCES match_innings(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id),
  runs_by_over jsonb DEFAULT '[]',
  wickets_by_over jsonb DEFAULT '[]',
  manhattan_chart jsonb DEFAULT '[]',
  wagon_wheel jsonb DEFAULT '[]',
  partnership_chart jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(match_id, innings_id, team_id)
);

-- Enable RLS
ALTER TABLE match_innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_batsmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_bowlers ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for match innings
CREATE POLICY "Anyone can read match innings"
  ON match_innings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match innings"
  ON match_innings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Create policies for match batsmen
CREATE POLICY "Anyone can read match batsmen"
  ON match_batsmen FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match batsmen"
  ON match_batsmen FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Create policies for match bowlers
CREATE POLICY "Anyone can read match bowlers"
  ON match_bowlers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match bowlers"
  ON match_bowlers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Create policies for match partnerships
CREATE POLICY "Anyone can read match partnerships"
  ON match_partnerships FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match partnerships"
  ON match_partnerships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Create policies for match stats
CREATE POLICY "Anyone can read match stats"
  ON match_stats FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match stats"
  ON match_stats FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Function to create innings after match setup
CREATE OR REPLACE FUNCTION create_match_innings()
RETURNS trigger AS $$
BEGIN
  -- Only create innings when match status changes to 'live'
  IF NEW.status = 'live' AND OLD.status = 'upcoming' THEN
    -- Create first innings
    INSERT INTO match_innings (
      match_id,
      innings_number,
      batting_team_id,
      bowling_team_id
    ) VALUES (
      NEW.id,
      1,
      CASE 
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bat' THEN NEW.team1_id
        WHEN NEW.toss_winner = NEW.team2_id AND NEW.toss_decision = 'bat' THEN NEW.team2_id
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bowl' THEN NEW.team2_id
        ELSE NEW.team1_id
      END,
      CASE 
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bat' THEN NEW.team2_id
        WHEN NEW.toss_winner = NEW.team2_id AND NEW.toss_decision = 'bat' THEN NEW.team1_id
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bowl' THEN NEW.team1_id
        ELSE NEW.team2_id
      END
    );

    -- Create second innings
    INSERT INTO match_innings (
      match_id,
      innings_number,
      batting_team_id,
      bowling_team_id
    ) VALUES (
      NEW.id,
      2,
      CASE 
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bat' THEN NEW.team2_id
        WHEN NEW.toss_winner = NEW.team2_id AND NEW.toss_decision = 'bat' THEN NEW.team1_id
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bowl' THEN NEW.team1_id
        ELSE NEW.team2_id
      END,
      CASE 
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bat' THEN NEW.team1_id
        WHEN NEW.toss_winner = NEW.team2_id AND NEW.toss_decision = 'bat' THEN NEW.team2_id
        WHEN NEW.toss_winner = NEW.team1_id AND NEW.toss_decision = 'bowl' THEN NEW.team2_id
        ELSE NEW.team1_id
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for innings creation
CREATE TRIGGER create_match_innings_trigger
  AFTER UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION create_match_innings();

-- Function to update match statistics
CREATE OR REPLACE FUNCTION update_match_statistics()
RETURNS trigger AS $$
BEGIN
  -- Update batsman statistics
  IF TG_TABLE_NAME = 'balls' THEN
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
      AND is_striker = true;

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
      AND is_current_bowler = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for statistics updates
CREATE TRIGGER update_match_statistics_trigger
  AFTER INSERT ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_match_statistics();