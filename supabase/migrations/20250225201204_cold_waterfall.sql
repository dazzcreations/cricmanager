/*
  # Fix match squads trigger issues
  
  1. Changes
    - Drop existing trigger and function
    - Create new AFTER trigger with improved logic
    - Add TRUNCATE permission to match_squads table
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS handle_match_squad_assignments_trigger ON match_squads;
DROP FUNCTION IF EXISTS handle_match_squad_assignments();

-- Create new function with improved logic
CREATE OR REPLACE FUNCTION handle_match_squad_assignments()
RETURNS trigger AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- Handle captain assignment
  IF NEW.is_captain THEN
    UPDATE match_squads
    SET is_captain = false
    WHERE match_id = NEW.match_id
      AND team_id = NEW.team_id
      AND player_id != NEW.player_id
      AND is_captain = true;
  END IF;

  -- Handle vice captain assignment
  IF NEW.is_vice_captain THEN
    UPDATE match_squads
    SET is_vice_captain = false
    WHERE match_id = NEW.match_id
      AND team_id = NEW.team_id
      AND player_id != NEW.player_id
      AND is_vice_captain = true;
  END IF;

  -- Handle wicket keeper assignment
  IF NEW.is_wicket_keeper THEN
    UPDATE match_squads
    SET is_wicket_keeper = false
    WHERE match_id = NEW.match_id
      AND team_id = NEW.team_id
      AND player_id != NEW.player_id
      AND is_wicket_keeper = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new AFTER trigger
CREATE TRIGGER handle_match_squad_assignments_trigger
  AFTER INSERT OR UPDATE ON match_squads
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_squad_assignments();

-- Add TRUNCATE permission to match_squads
ALTER TABLE match_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scorers and admins can truncate match squads"
  ON match_squads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('scorer', 'admin', 'super_admin')
    )
  );