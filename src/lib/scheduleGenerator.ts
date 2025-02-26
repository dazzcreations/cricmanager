import { addDays, addHours, parse, setHours, setMinutes } from 'date-fns';

interface Team {
  id: string;
  name: string;
}

interface ScheduleOptions {
  startDate: string;
  defaultTime: string;
  matchDuration: number;
  matchesPerDay: number;
  venue: string;
  gameType: string;
  tournamentId: string;
}

function validateOptions(options: ScheduleOptions) {
  if (!options.tournamentId) {
    throw new Error('Tournament ID is required');
  }
  if (!options.startDate) {
    throw new Error('Start date is required');
  }
  if (!options.defaultTime) {
    throw new Error('Default time is required');
  }
  if (!options.venue) {
    throw new Error('Venue is required');
  }
  if (options.matchDuration < 1) {
    throw new Error('Match duration must be at least 1 hour');
  }
  if (options.matchesPerDay < 1) {
    throw new Error('Must have at least 1 match per day');
  }
  if (!options.gameType) {
    throw new Error('Game type is required');
  }
}

function validateTeams(teams: Team[]) {
  if (!Array.isArray(teams)) {
    throw new Error('Teams must be an array');
  }
  if (teams.length < 2) {
    throw new Error('At least 2 teams are required to generate a schedule');
  }
  teams.forEach(team => {
    if (!team.id) {
      throw new Error('Each team must have an ID');
    }
    if (!team.name) {
      throw new Error('Each team must have a name');
    }
  });
}

export function generateRoundRobinSchedule(teams: Team[], options: ScheduleOptions) {
  try {
    validateOptions(options);
    validateTeams(teams);

    const matches = [];
    const numTeams = teams.length;
    const [defaultHours, defaultMinutes] = options.defaultTime.split(':').map(Number);
    let currentDate = new Date(options.startDate);
    let matchIndex = 0;

    // If odd number of teams, add a "bye" team
    const roundTeams = numTeams % 2 === 0 ? teams : [...teams, { id: 'bye', name: 'BYE' }];
    const rounds = roundTeams.length - 1;
    const matchesPerRound = Math.floor(roundTeams.length / 2);

    // Initialize the schedule array with team indices
    const schedule = [];
    for (let i = 0; i < roundTeams.length - 1; i++) {
      schedule.push(i);
    }

    for (let round = 0; round < rounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const homeIndex = match;
        const awayIndex = roundTeams.length - 1 - match;

        // Skip matches involving the "bye" team
        if (roundTeams[schedule[homeIndex]].id !== 'bye' && roundTeams[schedule[awayIndex]].id !== 'bye') {
          let matchTime = new Date(currentDate);
          matchTime = setHours(matchTime, defaultHours);
          matchTime = setMinutes(matchTime, defaultMinutes);
          matchTime = addHours(matchTime, (matchIndex % options.matchesPerDay) * options.matchDuration);

          matches.push({
            tournament_id: options.tournamentId,
            type: options.gameType,
            team1_id: roundTeams[schedule[homeIndex]].id,
            team2_id: roundTeams[schedule[awayIndex]].id,
            venue: options.venue,
            date: matchTime.toISOString(),
            status: 'upcoming'
          });

          matchIndex++;
          if (matchIndex % options.matchesPerDay === 0) {
            currentDate = addDays(currentDate, 1);
          }
        }
      }

      // Rotate the schedule array (keeping the first element fixed)
      const temp = schedule[schedule.length - 1];
      for (let i = schedule.length - 1; i > 1; i--) {
        schedule[i] = schedule[i - 1];
      }
      schedule[1] = temp;
    }

    return matches;
  } catch (error) {
    throw new Error(`Failed to generate round robin schedule: ${error.message}`);
  }
}

export function generateKnockoutSchedule(teams: Team[], options: ScheduleOptions) {
  try {
    validateOptions(options);
    validateTeams(teams);

    const matches = [];
    let currentDate = new Date(options.startDate);
    const [defaultHours, defaultMinutes] = options.defaultTime.split(':').map(Number);
    let matchIndex = 0;

    // Shuffle teams randomly
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

    // Generate first round matches
    for (let i = 0; i < shuffledTeams.length - 1; i += 2) {
      let matchTime = new Date(currentDate);
      matchTime = setHours(matchTime, defaultHours);
      matchTime = setMinutes(matchTime, defaultMinutes);
      matchTime = addHours(matchTime, (matchIndex % options.matchesPerDay) * options.matchDuration);

      matches.push({
        tournament_id: options.tournamentId,
        type: options.gameType,
        team1_id: shuffledTeams[i].id,
        team2_id: shuffledTeams[i + 1].id,
        venue: options.venue,
        date: matchTime.toISOString(),
        status: 'upcoming'
      });

      matchIndex++;
      if (matchIndex % options.matchesPerDay === 0) {
        currentDate = addDays(currentDate, 1);
      }
    }

    return matches;
  } catch (error) {
    throw new Error(`Failed to generate knockout schedule: ${error.message}`);
  }
}

export function generateLeagueSchedule(teams: Team[], options: ScheduleOptions) {
  try {
    validateOptions(options);
    validateTeams(teams);

    // For league format, we'll use round robin but with home and away matches
    const firstHalf = generateRoundRobinSchedule(teams, options);
    
    // For second half, swap home and away teams and adjust dates
    const secondHalf = firstHalf.map(match => {
      const matchDate = addDays(new Date(match.date), 30); // Add 30 days for return fixtures
      
      return {
        ...match,
        team1_id: match.team2_id,
        team2_id: match.team1_id,
        date: matchDate.toISOString()
      };
    });

    return [...firstHalf, ...secondHalf];
  } catch (error) {
    throw new Error(`Failed to generate league schedule: ${error.message}`);
  }
}

export function generateGroupStageSchedule(teams: Team[], options: ScheduleOptions) {
  try {
    validateOptions(options);
    validateTeams(teams);

    if (teams.length < 4) {
      throw new Error('At least 4 teams are required for group stage format');
    }

    const matches = [];
    const groupCount = Math.ceil(teams.length / 4); // Assuming 4 teams per group
    const groups: Team[][] = Array.from({ length: groupCount }, () => []);

    // Distribute teams into groups
    teams.forEach((team, index) => {
      groups[index % groupCount].push(team);
    });

    // Generate matches for each group
    groups.forEach((groupTeams, groupIndex) => {
      const groupStartDate = addDays(new Date(options.startDate), groupIndex * 7); // One week per group
      const groupOptions = {
        ...options,
        startDate: groupStartDate.toISOString()
      };

      const groupMatches = generateRoundRobinSchedule(groupTeams, groupOptions);
      matches.push(...groupMatches);
    });

    return matches;
  } catch (error) {
    throw new Error(`Failed to generate group stage schedule: ${error.message}`);
  }
}

export function generateSchedule(format: string, teams: Team[], options: ScheduleOptions) {
  try {
    validateOptions(options);
    validateTeams(teams);

    switch (format) {
      case 'single_elimination':
        if (teams.length < 4) {
          throw new Error('At least 4 teams are required for single elimination format');
        }
        return generateKnockoutSchedule(teams, options);
      case 'double_elimination':
        if (teams.length < 4) {
          throw new Error('At least 4 teams are required for double elimination format');
        }
        return generateKnockoutSchedule(teams, options);
      case 'round_robin':
        return generateRoundRobinSchedule(teams, options);
      case 'league':
        return generateLeagueSchedule(teams, options);
      case 'group_stage_knockout':
        if (teams.length < 8) {
          throw new Error('At least 8 teams are required for group stage knockout format');
        }
        return generateGroupStageSchedule(teams, options);
      default:
        throw new Error(`Unsupported tournament format: ${format}`);
    }
  } catch (error) {
    throw new Error(`Failed to generate schedule: ${error.message}`);
  }
}