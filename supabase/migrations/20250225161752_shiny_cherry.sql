/*
  # Create cricket tournament tables

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

    - `matches`
      - `id` (uuid, primary key)
      - `type` (match_type enum)
      - `status` (match_status enum)
      - `team1_id` (uuid, references teams)
      - `team2_id` (uuid, references teams)
      - `venue` (text)
      - `date` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

    - `innings`
      - `id` (uuid, primary key)
      - `match_id` (uuid, references matches)
      - `batting_team_id` (uuid, references teams)
      - `bowling_team_id` (uuid, references teams)
      - `total_runs` (integer)
      - `total_wickets` (integer)
      - `overs` (numeric)
      - `extras` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `balls`
      - `id` (uuid, primary key)
      - `innings_id` (uuid, references innings)
      - `over_number` (integer)
      - `ball_number` (integer)
      - `batsman_id` (uuid, references players)
      - `bowler_id` (uuid, references players)
      - `runs` (integer)
      - `extras` (jsonb)
      - `wicket_type` (wicket_type enum)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users and admin/scorer roles
*/

-- Create ENUMs
CREATE TYPE match_type AS ENUM ('ODI', 'T20');
CREATE TYPE match_status AS ENUM ('upcoming', 'live', 'completed');
CREATE TYPE wicket_type AS ENUM (
  'bowled',
  'caught',
  'lbw',
  'run_out',
  'stumped',
  'hit_wicket',
  'retired_hurt',
  'obstructing',
  'hit_ball_twice',
  'timed_out'
);

-- Create teams table first
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id),
  name text NOT NULL,
  role text NOT NULL,
  batting_style text,
  bowling_style text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type match_type NOT NULL,
  status match_status NOT NULL DEFAULT 'upcoming',
  team1_id uuid NOT NULL REFERENCES teams(id),
  team2_id uuid NOT NULL REFERENCES teams(id),
  venue text NOT NULL,
  date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create innings table
CREATE TABLE IF NOT EXISTS innings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id),
  batting_team_id uuid NOT NULL REFERENCES teams(id),
  bowling_team_id uuid NOT NULL REFERENCES teams(id),
  total_runs integer DEFAULT 0,
  total_wickets integer DEFAULT 0,
  overs numeric(4,1) DEFAULT 0,
  extras jsonb DEFAULT '{"wides": 0, "no_balls": 0, "byes": 0, "leg_byes": 0}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create balls table
CREATE TABLE IF NOT EXISTS balls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id uuid NOT NULL REFERENCES innings(id),
  over_number integer NOT NULL,
  ball_number integer NOT NULL,
  batsman_id uuid NOT NULL REFERENCES players(id),
  bowler_id uuid NOT NULL REFERENCES players(id),
  runs integer DEFAULT 0,
  extras jsonb DEFAULT '{"wides": 0, "no_balls": 0, "byes": 0, "leg_byes": 0}'::jsonb,
  wicket_type wicket_type DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(innings_id, over_number, ball_number)
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE balls ENABLE ROW LEVEL SECURITY;

-- Policies for teams
CREATE POLICY "Anyone can read teams"
  ON teams
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for players
CREATE POLICY "Anyone can read players"
  ON players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins and team managers can manage players"
  ON players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'teamManager')
    )
  );

-- Policies for matches
CREATE POLICY "Anyone can read matches"
  ON matches
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can create matches"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  );

CREATE POLICY "Scorers and admins can update matches"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  );

-- Policies for innings
CREATE POLICY "Anyone can read innings"
  ON innings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can create innings"
  ON innings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  );

CREATE POLICY "Scorers and admins can update innings"
  ON innings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  );

-- Policies for balls
CREATE POLICY "Anyone can read balls"
  ON balls
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Scorers and admins can create balls"
  ON balls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  );

CREATE POLICY "Scorers and admins can update balls"
  ON balls
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin')
    )
  );

-- Function to update innings totals
CREATE OR REPLACE FUNCTION update_innings_totals()
RETURNS trigger AS $$
BEGIN
  UPDATE innings
  SET
    total_runs = (
      SELECT COALESCE(SUM(runs), 0) +
             COALESCE(SUM((extras->>'wides')::int), 0) +
             COALESCE(SUM((extras->>'no_balls')::int), 0) +
             COALESCE(SUM((extras->>'byes')::int), 0) +
             COALESCE(SUM((extras->>'leg_byes')::int), 0)
      FROM balls
      WHERE balls.innings_id = innings.id
    ),
    total_wickets = (
      SELECT COUNT(*)
      FROM balls
      WHERE balls.innings_id = innings.id
      AND wicket_type IS NOT NULL
    ),
    overs = (
      SELECT COUNT(DISTINCT over_number) - 1 +
             (SELECT COUNT(*) FROM balls b2
              WHERE b2.innings_id = innings.id
              AND b2.over_number = (
                SELECT MAX(over_number)
                FROM balls b3
                WHERE b3.innings_id = innings.id
              )) / 6.0
      FROM balls
      WHERE balls.innings_id = innings.id
    ),
    updated_at = now()
  WHERE id = NEW.innings_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update innings totals
CREATE TRIGGER update_innings_totals_trigger
  AFTER INSERT OR UPDATE ON balls
  FOR EACH ROW
  EXECUTE FUNCTION update_innings_totals();