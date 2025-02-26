/*
  # Add tournament_id to matches table

  1. Changes
    - Add tournament_id column to matches table
    - Add foreign key constraint to tournaments table
    - Add index for better query performance
*/

-- Add tournament_id column to matches table
ALTER TABLE matches
ADD COLUMN tournament_id uuid REFERENCES tournaments(id);

-- Create index for tournament_id
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);

-- Update RLS policies to include tournament context
CREATE POLICY "Scorers and admins can create tournament matches"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Scorers and admins can update tournament matches"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );