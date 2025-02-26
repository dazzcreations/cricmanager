import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../lib/supabase';
import type { Match, Innings, Ball } from '../../types';

interface MatchesState {
  matches: Match[];
  currentMatch: Match | null;
  currentInnings: Innings | null;
  recentBalls: Ball[];
  loading: boolean;
  error: string | null;
}

const initialState: MatchesState = {
  matches: [],
  currentMatch: null,
  currentInnings: null,
  recentBalls: [],
  loading: false,
  error: null,
};

export const fetchMatches = createAsyncThunk(
  'matches/fetchMatches',
  async () => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team1:teams!team1_id(*),
        team2:teams!team2_id(*)
      `)
      .order('date', { ascending: true });

    if (error) throw error;
    return data;
  }
);

export const fetchMatchById = createAsyncThunk(
  'matches/fetchMatchById',
  async (matchId: string) => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team1:teams!team1_id(*),
        team2:teams!team2_id(*),
        innings(*)
      `)
      .eq('id', matchId)
      .single();

    if (error) throw error;
    return data;
  }
);

export const createMatch = createAsyncThunk(
  'matches/createMatch',
  async (match: Partial<Match>) => {
    const { data, error } = await supabase
      .from('matches')
      .insert(match)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
);

const matchesSlice = createSlice({
  name: 'matches',
  initialState,
  reducers: {
    setCurrentMatch: (state, action: PayloadAction<Match>) => {
      state.currentMatch = action.payload;
    },
    setCurrentInnings: (state, action: PayloadAction<Innings>) => {
      state.currentInnings = action.payload;
    },
    addBall: (state, action: PayloadAction<Ball>) => {
      state.recentBalls = [action.payload, ...state.recentBalls.slice(0, 9)];
    },
    clearMatch: (state) => {
      state.currentMatch = null;
      state.currentInnings = null;
      state.recentBalls = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMatches.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMatches.fulfilled, (state, action) => {
        state.matches = action.payload;
        state.loading = false;
      })
      .addCase(fetchMatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch matches';
      })
      .addCase(fetchMatchById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMatchById.fulfilled, (state, action) => {
        state.currentMatch = action.payload;
        state.loading = false;
      })
      .addCase(fetchMatchById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch match';
      })
      .addCase(createMatch.fulfilled, (state, action) => {
        state.matches.push(action.payload);
      });
  },
});

export const { setCurrentMatch, setCurrentInnings, addBall, clearMatch } =
  matchesSlice.actions;
export default matchesSlice.reducer;