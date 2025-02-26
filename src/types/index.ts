export interface User {
  id: string;
  name: string;
  role: 'admin' | 'player' | 'teamManager' | 'scorer' | 'umpire' | 'spectator';
  email: string;
}

export interface Player {
  id: string;
  name: string;
  role: 'batsman' | 'bowler' | 'allRounder';
  battingStyle: 'left' | 'right';
  bowlingStyle?: string;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    average: number;
    strikeRate: number;
  };
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  captain?: Player;
  viceCaptain?: Player;
}

export interface Match {
  id: string;
  type: 'ODI' | 'T20';
  teams: {
    team1: Team;
    team2: Team;
  };
  date: string;
  venue: string;
  status: 'upcoming' | 'live' | 'completed';
  innings?: Innings[];
}

export interface Innings {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  total_runs: number;
  total_wickets: number;
  overs: number;
  extras: {
    wides: number;
    no_balls: number;
    byes: number;
    leg_byes: number;
  };
}

export interface Ball {
  id: string;
  innings_id: string;
  over_number: number;
  ball_number: number;
  batsman_id: string;
  bowler_id: string;
  runs: number;
  extras?: {
    wides: number;
    no_balls: number;
    byes: number;
    leg_byes: number;
  };
  wicket_type?: string;
}