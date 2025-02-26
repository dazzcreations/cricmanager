import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../lib/supabase';
import { db, syncTeams, syncPlayers, addPendingAction } from '../../lib/db';
import type { Database } from '../../types/supabase';

type Team = Database['public']['Tables']['teams']['Row'];
type Player = Database['public']['Tables']['players']['Row'];

interface TeamsState {
  teams: Team[];
  players: Record<string, Player[]>;
  selectedTeam: Team | null;
  loading: boolean;
  error: string | null;
  isOnline: boolean;
}

const initialState: TeamsState = {
  teams: [],
  players: {},
  selectedTeam: null,
  loading: false,
  error: null,
  isOnline: navigator.onLine
};

export const fetchTeams = createAsyncThunk(
  'teams/fetchTeams',
  async (_, { getState }) => {
    const state = getState() as { teams: TeamsState };
    
    if (!state.teams.isOnline) {
      return db.getAllFromIndex('teams', 'by-name');
    }

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) throw error;

    // Sync with IndexedDB
    await syncTeams(data);
    return data;
  }
);

export const fetchTeamPlayers = createAsyncThunk(
  'teams/fetchTeamPlayers',
  async (teamId: string, { getState }) => {
    const state = getState() as { teams: TeamsState };
    
    if (!state.teams.isOnline) {
      const players = await db.getAllFromIndex('players', 'by-team', teamId);
      return { teamId, players };
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('name');

    if (error) throw error;

    // Sync with IndexedDB
    await syncPlayers(data);
    return { teamId, players: data };
  }
);

export const createTeam = createAsyncThunk(
  'teams/createTeam',
  async ({ name }: { name: string }, { getState }) => {
    const state = getState() as { teams: TeamsState };
    const newTeam = {
      id: crypto.randomUUID(),
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null
    };

    if (!state.teams.isOnline) {
      await db.add('teams', newTeam);
      await addPendingAction('create', 'teams', newTeam);
      return newTeam;
    }

    const { data, error } = await supabase
      .from('teams')
      .insert(newTeam)
      .select()
      .single();

    if (error) throw error;

    // Sync with IndexedDB
    await db.put('teams', data);
    return data;
  }
);

export const updateTeam = createAsyncThunk(
  'teams/updateTeam',
  async ({ id, name }: { id: string; name: string }, { getState }) => {
    const state = getState() as { teams: TeamsState };
    const updatedTeam = {
      id,
      name,
      updated_at: new Date().toISOString()
    };

    if (!state.teams.isOnline) {
      await db.put('teams', updatedTeam);
      await addPendingAction('update', 'teams', updatedTeam);
      return updatedTeam;
    }

    const { data, error } = await supabase
      .from('teams')
      .update(updatedTeam)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Sync with IndexedDB
    await db.put('teams', data);
    return data;
  }
);

export const createPlayer = createAsyncThunk(
  'teams/createPlayer',
  async (player: Database['public']['Tables']['players']['Insert'], { getState }) => {
    const state = getState() as { teams: TeamsState };
    const newPlayer = {
      ...player,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!state.teams.isOnline) {
      await db.add('players', newPlayer);
      await addPendingAction('create', 'players', newPlayer);
      return newPlayer;
    }

    const { data, error } = await supabase
      .from('players')
      .insert(newPlayer)
      .select()
      .single();

    if (error) throw error;

    // Sync with IndexedDB
    await db.put('players', data);
    return data;
  }
);

const teamsSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    setSelectedTeam: (state, action) => {
      state.selectedTeam = action.payload;
    },
    setOnlineStatus: (state, action) => {
      state.isOnline = action.payload;
    },
    addTeam: (state, action) => {
      const team = action.payload;
      if (!state.teams.find(t => t.id === team.id)) {
        state.teams.push(team);
        state.teams.sort((a, b) => a.name.localeCompare(b.name));
      }
    },
    updateTeam: (state, action) => {
      const team = action.payload;
      const index = state.teams.findIndex(t => t.id === team.id);
      if (index !== -1) {
        state.teams[index] = team;
      }
      if (state.selectedTeam?.id === team.id) {
        state.selectedTeam = team;
      }
    },
    removeTeam: (state, action) => {
      const teamId = action.payload;
      state.teams = state.teams.filter(team => team.id !== teamId);
      if (state.selectedTeam?.id === teamId) {
        state.selectedTeam = null;
      }
      delete state.players[teamId];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action) => {
        state.teams = action.payload;
        state.loading = false;
      })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch teams';
      })
      .addCase(fetchTeamPlayers.fulfilled, (state, action) => {
        state.players[action.payload.teamId] = action.payload.players;
      })
      .addCase(createTeam.fulfilled, (state, action) => {
        state.teams.push(action.payload);
        state.teams.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateTeam.fulfilled, (state, action) => {
        const index = state.teams.findIndex(team => team.id === action.payload.id);
        if (index !== -1) {
          state.teams[index] = action.payload;
        }
        if (state.selectedTeam?.id === action.payload.id) {
          state.selectedTeam = action.payload;
        }
      })
      .addCase(createPlayer.fulfilled, (state, action) => {
        const teamId = action.payload.team_id;
        if (teamId) {
          if (!state.players[teamId]) {
            state.players[teamId] = [];
          }
          state.players[teamId].push(action.payload);
          state.players[teamId].sort((a, b) => a.name.localeCompare(b.name));
        }
      });
  },
});

export const { setSelectedTeam, setOnlineStatus, addTeam, updateTeam: updateTeamAction, removeTeam } = teamsSlice.actions;
export default teamsSlice.reducer;