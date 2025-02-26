/*
  # Insert Teams and Players Data

  1. Teams
    - India National Cricket Team
    - England Cricket Team

  2. Players
    - Indian Team Players (11 players)
    - England Team Players (11 players)

  This migration inserts initial team and player data with complete details including:
    - Team information (name, home ground, founded year)
    - Player details (name, role, batting/bowling styles, jersey numbers)
    - Team-player associations
*/

-- Create UUIDs for teams
DO $$
DECLARE
  ind_team_id uuid := gen_random_uuid();
  eng_team_id uuid := gen_random_uuid();
  -- India players
  ind_p1_id uuid := gen_random_uuid();
  ind_p2_id uuid := gen_random_uuid();
  ind_p3_id uuid := gen_random_uuid();
  ind_p4_id uuid := gen_random_uuid();
  ind_p5_id uuid := gen_random_uuid();
  ind_p6_id uuid := gen_random_uuid();
  ind_p7_id uuid := gen_random_uuid();
  ind_p8_id uuid := gen_random_uuid();
  ind_p9_id uuid := gen_random_uuid();
  ind_p10_id uuid := gen_random_uuid();
  ind_p11_id uuid := gen_random_uuid();
  -- England players
  eng_p1_id uuid := gen_random_uuid();
  eng_p2_id uuid := gen_random_uuid();
  eng_p3_id uuid := gen_random_uuid();
  eng_p4_id uuid := gen_random_uuid();
  eng_p5_id uuid := gen_random_uuid();
  eng_p6_id uuid := gen_random_uuid();
  eng_p7_id uuid := gen_random_uuid();
  eng_p8_id uuid := gen_random_uuid();
  eng_p9_id uuid := gen_random_uuid();
  eng_p10_id uuid := gen_random_uuid();
  eng_p11_id uuid := gen_random_uuid();
BEGIN
  -- Insert Teams
  INSERT INTO teams (id, name, short_name, home_ground, founded_year) VALUES
    (ind_team_id, 'India National Cricket Team', 'IND', 'Wankhede Stadium, Mumbai', 1932),
    (eng_team_id, 'England Cricket Team', 'ENG', 'Lord''s Cricket Ground, London', 1877);

  -- Insert Indian Players
  INSERT INTO players (id, name, role, batting_style, bowling_style, jersey_number, status) VALUES
    (ind_p1_id, 'Rohit Sharma', 'batsman', 'right_hand', 'right_arm_off_spin', 45, 'active'),
    (ind_p2_id, 'Virat Kohli', 'batsman', 'right_hand', 'right_arm_medium', 18, 'active'),
    (ind_p3_id, 'Shubman Gill', 'batsman', 'right_hand', NULL, 77, 'active'),
    (ind_p4_id, 'KL Rahul', 'wicket_keeper', 'right_hand', NULL, 1, 'active'),
    (ind_p5_id, 'Rishabh Pant', 'wicket_keeper', 'left_hand', NULL, 17, 'active'),
    (ind_p6_id, 'Hardik Pandya', 'all_rounder', 'right_hand', 'right_arm_fast_medium', 33, 'active'),
    (ind_p7_id, 'Ravindra Jadeja', 'all_rounder', 'left_hand', 'left_arm_orthodox', 8, 'active'),
    (ind_p8_id, 'Jasprit Bumrah', 'bowler', 'right_hand', 'right_arm_fast', 93, 'active'),
    (ind_p9_id, 'Mohammed Shami', 'bowler', 'right_hand', 'right_arm_fast', 11, 'active'),
    (ind_p10_id, 'Mohammed Siraj', 'bowler', 'right_hand', 'right_arm_fast', 13, 'active'),
    (ind_p11_id, 'Kuldeep Yadav', 'bowler', 'left_hand', 'left_arm_wrist_spin', 23, 'active');

  -- Insert England Players
  INSERT INTO players (id, name, role, batting_style, bowling_style, jersey_number, status) VALUES
    (eng_p1_id, 'Jos Buttler', 'wicket_keeper', 'right_hand', NULL, 63, 'active'),
    (eng_p2_id, 'Jonny Bairstow', 'batsman', 'right_hand', NULL, 51, 'active'),
    (eng_p3_id, 'Joe Root', 'batsman', 'right_hand', 'right_arm_off_spin', 66, 'active'),
    (eng_p4_id, 'Ben Stokes', 'all_rounder', 'left_hand', 'right_arm_fast_medium', 55, 'active'),
    (eng_p5_id, 'Liam Livingstone', 'all_rounder', 'right_hand', 'right_arm_leg_spin', 23, 'active'),
    (eng_p6_id, 'Harry Brook', 'batsman', 'right_hand', 'right_arm_medium', 27, 'active'),
    (eng_p7_id, 'Moeen Ali', 'all_rounder', 'left_hand', 'right_arm_off_spin', 18, 'active'),
    (eng_p8_id, 'Sam Curran', 'all_rounder', 'left_hand', 'left_arm_medium_fast', 58, 'active'),
    (eng_p9_id, 'Jofra Archer', 'bowler', 'right_hand', 'right_arm_fast', 22, 'active'),
    (eng_p10_id, 'Mark Wood', 'bowler', 'right_hand', 'right_arm_fast', 33, 'active'),
    (eng_p11_id, 'Adil Rashid', 'bowler', 'right_hand', 'right_arm_leg_spin', 8, 'active');

  -- Associate Players with Teams
  INSERT INTO team_players (team_id, player_id, role, jersey_number, is_captain) VALUES
    -- India Team
    (ind_team_id, ind_p1_id, 'batsman', 45, true),  -- Rohit Sharma (Captain)
    (ind_team_id, ind_p2_id, 'batsman', 18, false),
    (ind_team_id, ind_p3_id, 'batsman', 77, false),
    (ind_team_id, ind_p4_id, 'wicket_keeper', 1, false),
    (ind_team_id, ind_p5_id, 'wicket_keeper', 17, false),
    (ind_team_id, ind_p6_id, 'all_rounder', 33, false),
    (ind_team_id, ind_p7_id, 'all_rounder', 8, false),
    (ind_team_id, ind_p8_id, 'bowler', 93, false),
    (ind_team_id, ind_p9_id, 'bowler', 11, false),
    (ind_team_id, ind_p10_id, 'bowler', 13, false),
    (ind_team_id, ind_p11_id, 'bowler', 23, false),
    
    -- England Team
    (eng_team_id, eng_p1_id, 'wicket_keeper', 63, true),  -- Jos Buttler (Captain)
    (eng_team_id, eng_p2_id, 'batsman', 51, false),
    (eng_team_id, eng_p3_id, 'batsman', 66, false),
    (eng_team_id, eng_p4_id, 'all_rounder', 55, false),
    (eng_team_id, eng_p5_id, 'all_rounder', 23, false),
    (eng_team_id, eng_p6_id, 'batsman', 27, false),
    (eng_team_id, eng_p7_id, 'all_rounder', 18, false),
    (eng_team_id, eng_p8_id, 'all_rounder', 58, false),
    (eng_team_id, eng_p9_id, 'bowler', 22, false),
    (eng_team_id, eng_p10_id, 'bowler', 33, false),
    (eng_team_id, eng_p11_id, 'bowler', 8, false);
END $$;