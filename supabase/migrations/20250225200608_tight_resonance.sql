/*
  # Add toss columns to matches table
  
  1. Changes
    - Add toss_winner column referencing teams table
    - Add toss_decision enum type and column
    - Add toss_time column to record when toss occurred
    
  2. Security
    - Maintain existing RLS policies
*/

-- Create toss decision enum
CREATE TYPE toss_decision AS ENUM ('bat', 'bowl');

-- Add toss columns to matches table
ALTER TABLE matches
  ADD COLUMN toss_winner uuid REFERENCES teams(id),
  ADD COLUMN toss_decision toss_decision,
  ADD COLUMN toss_time timestamptz DEFAULT now();

-- Create index for toss winner
CREATE INDEX idx_matches_toss_winner ON matches(toss_winner);

-- Add constraint to ensure toss decision is set when winner is set
ALTER TABLE matches
  ADD CONSTRAINT matches_toss_check 
  CHECK ((toss_winner IS NULL AND toss_decision IS NULL) OR 
         (toss_winner IS NOT NULL AND toss_decision IS NOT NULL));