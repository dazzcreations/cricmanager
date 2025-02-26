/*
  # Fix match innings table and policies

  1. Changes
    - Create match_innings table if not exists
    - Add required columns and constraints
    - Add RLS policies with unique names
    - Add indexes for performance

  2. New Tables
    - match_innings (if not exists)

  3. Modified Tables
    - None
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

-- Enable RLS
ALTER TABLE match_innings ENABLE ROW LEVEL SECURITY;

-- Create policies with unique names
CREATE POLICY "match_innings_read_policy"
  ON match_innings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "match_innings_write_policy"
  ON match_innings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_match_innings_match_id ON match_innings(match_id);
CREATE INDEX IF NOT EXISTS idx_match_innings_teams ON match_innings(batting_team_id, bowling_team_id);
CREATE INDEX IF NOT EXISTS idx_match_innings_current_players ON match_innings(current_bowler_id, current_batsman_id, current_non_striker_id);