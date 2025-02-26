/*
  # Update match squads trigger
  
  1. Changes
    - Convert BEFORE trigger to AFTER trigger for match squad validations
    - Fix concurrent update issues
    - Improve trigger function logic
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS validate_match_squad_assignments_trigger ON match_squads;
DROP FUNCTION IF EXISTS validate_match_squad_assignments();

-- Create new function with improved logic
CREATE OR REPLACE FUNCTION handle_match_squad_assignments()
RETURNS trigger AS $$
BEGIN
  -- Handle captain assignment
  IF NEW.is_captain THEN
    UPDATE match_squads
    SET is_captain = false
    WHERE match_id = NEW.match_id
      AND team_id = NEW.team_id
      AND id != NEW.id
      AND is_captain = true;
  END IF;

  -- Handle vice captain assignment
  IF NEW.is_vice_captain THEN
    UPDATE match_squads
    SET is_vice_captain = false
    WHERE match_id = NEW.match_id
      AND team_id = NEW.team_id
      AND id != NEW.id
      AND is_vice_captain = true;
  END IF;

  -- Handle wicket keeper assignment
  IF NEW.is_wicket_keeper THEN
    UPDATE match_squads
    SET is_wicket_keeper = false
    WHERE match_id = NEW.match_id
      AND team_id = NEW.team_id
      AND id != NEW.id
      AND is_wicket_keeper = true;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create new AFTER trigger
CREATE TRIGGER handle_match_squad_assignments_trigger
  AFTER INSERT OR UPDATE ON match_squads
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_squad_assignments();