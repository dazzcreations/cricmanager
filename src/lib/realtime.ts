import { supabase } from './supabase';
import { store } from '../store';
import { addTeam, updateTeam, removeTeam } from '../store/slices/teamsSlice';
import type { Database } from '../types/supabase';

type Team = Database['public']['Tables']['teams']['Row'];
type Player = Database['public']['Tables']['players']['Row'];

export function setupRealtimeSubscriptions() {
  // Teams channel
  const teamsChannel = supabase
    .channel('teams-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'teams'
      },
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            store.dispatch(addTeam(payload.new as Team));
            break;
          case 'UPDATE':
            store.dispatch(updateTeam(payload.new as Team));
            break;
          case 'DELETE':
            store.dispatch(removeTeam(payload.old.id));
            break;
        }
      }
    )
    .subscribe();

  // Players channel
  const playersChannel = supabase
    .channel('players-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players'
      },
      (payload) => {
        const teamId = (payload.new || payload.old)?.team_id;
        if (teamId) {
          // Fetch updated players list for the team
          store.dispatch(fetchTeamPlayers(teamId));
        }
      }
    )
    .subscribe();

  return () => {
    teamsChannel.unsubscribe();
    playersChannel.unsubscribe();
  };
}