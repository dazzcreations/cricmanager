/*
  # Fix Match Schema Relationships

  1. Changes
    - Create match_innings table first
    - Add current over tracking columns
    - Add spell tracking columns
    - Create proper foreign key relationships

  2. Security
    - Enable RLS
    - Create appropriate policies
*/

-- Create match_innings table if it doesn't exist
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
  current_over integer DEFAULT 0,
  current_ball integer DEFAULT 0,
  current_bowler_id uuid REFERENCES players(id),
  current_batsman_id uuid REFERENCES players(id),
  current_non_striker_id uuid REFERENCES players(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(match_id, innings_number)
);

-- Create match_batsmen table if it doesn't exist
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
  dismissal_bowler_id uuid REFERENCES players(id),
  fielder_id uuid REFERENCES players(id),
  is_striker boolean DEFAULT false,
  is_retired_hurt boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(innings_id, player_id)
);

-- Create match_bowlers table if it doesn't exist
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
  current_spell_overs numeric(4,1) DEFAULT 0,
  current_spell_runs integer DEFAULT 0,
  current_spell_wickets integer DEFAULT 0,
  spells jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(innings_id, player_id)
);

-- Enable RLS
ALTER TABLE match_innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_batsmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_bowlers ENABLE ROW LEVEL SECURITY;

-- Create policies for match_innings
CREATE POLICY "Public can read match_innings"
  ON match_innings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match_innings"
  ON match_innings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Create policies for match_batsmen
CREATE POLICY "Public can read match_batsmen"
  ON match_batsmen FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match_batsmen"
  ON match_batsmen FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Create policies for match_bowlers
CREATE POLICY "Public can read match_bowlers"
  ON match_bowlers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can manage match_bowlers"
  ON match_bowlers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );