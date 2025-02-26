/*
  # User Management System Enhancement

  1. New Types
    - user_role enum for role-based access control
    - user_status enum for account status
    - Audit logging for user management

  2. Changes
    - Drop existing policies that depend on the role column
    - Add new columns to profiles table
    - Convert role column to use enum type
    - Recreate policies with updated role references
    - Add audit logging capabilities

  3. Security
    - RLS policies for super_admin access
    - Audit logging triggers
*/

-- Create role and status enums
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'scorer', 'team_manager', 'player', 'spectator');
CREATE TYPE user_status AS ENUM ('active', 'disabled', 'pending');

-- Drop existing policies that depend on the role column
DROP POLICY IF EXISTS "Admins can manage teams" ON teams;
DROP POLICY IF EXISTS "Admins and team managers can manage players" ON players;
DROP POLICY IF EXISTS "Scorers and admins can create matches" ON matches;
DROP POLICY IF EXISTS "Scorers and admins can update matches" ON matches;
DROP POLICY IF EXISTS "Scorers and admins can create innings" ON innings;
DROP POLICY IF EXISTS "Scorers and admins can update innings" ON innings;
DROP POLICY IF EXISTS "Scorers and admins can create balls" ON balls;
DROP POLICY IF EXISTS "Scorers and admins can update balls" ON balls;
DROP POLICY IF EXISTS "Admins can manage tournaments" ON tournaments;
DROP POLICY IF EXISTS "Admins can manage tournament teams" ON tournament_teams;

-- Update existing roles to match new enum values
UPDATE profiles
SET role = 'spectator'
WHERE role NOT IN ('super_admin', 'admin', 'scorer', 'team_manager', 'player', 'spectator');

-- Add new columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login timestamptz,
  ADD COLUMN IF NOT EXISTS last_active timestamptz,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0;

-- Create a temporary column for the role conversion
ALTER TABLE profiles 
  ADD COLUMN role_new user_role;

-- Copy data to the new column, defaulting to 'spectator' if invalid
UPDATE profiles 
SET role_new = role::user_role;

-- Drop the old column
ALTER TABLE profiles 
  DROP COLUMN role;

-- Rename the new column
ALTER TABLE profiles 
  RENAME COLUMN role_new TO role;

-- Set the default for new rows
ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'spectator'::user_role;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for audit logs
CREATE POLICY "Super admins can read all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Recreate policies with updated role references
CREATE POLICY "Admins can manage teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins and team managers can manage players"
  ON players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'team_manager')
    )
  );

CREATE POLICY "Scorers and admins can create matches"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'scorer')
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
      AND profiles.role IN ('admin', 'super_admin', 'scorer')
    )
  );

CREATE POLICY "Scorers and admins can create innings"
  ON innings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'scorer')
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
      AND profiles.role IN ('admin', 'super_admin', 'scorer')
    )
  );

CREATE POLICY "Scorers and admins can create balls"
  ON balls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'scorer')
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
      AND profiles.role IN ('admin', 'super_admin', 'scorer')
    )
  );

CREATE POLICY "Admins can manage tournaments"
  ON tournaments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage tournament teams"
  ON tournament_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Function to log profile changes
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    changes,
    ip_address
  ) VALUES (
    auth.uid(),
    CASE 
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'delete'
      ELSE 'create'
    END,
    'profile',
    NEW.id,
    jsonb_build_object(
      'old', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE null END,
      'new', to_jsonb(NEW)
    ),
    inet_client_addr()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for audit logging
CREATE TRIGGER log_profile_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_changes();