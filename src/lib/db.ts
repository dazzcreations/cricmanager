import { openDB, DBSchema } from 'idb';
import type { Database } from '../types/supabase';

type Team = Database['public']['Tables']['teams']['Row'];
type Player = Database['public']['Tables']['players']['Row'];

interface CricketDB extends DBSchema {
  teams: {
    key: string;
    value: Team;
    indexes: {
      'by-name': string;
    };
  };
  players: {
    key: string;
    value: Player;
    indexes: {
      'by-team': string;
      'by-name': string;
    };
  };
  pendingActions: {
    key: string;
    value: {
      id: string;
      action: 'create' | 'update' | 'delete';
      table: 'teams' | 'players';
      data: any;
      timestamp: number;
    };
  };
}

export const db = await openDB<CricketDB>('cricket-db', 1, {
  upgrade(db) {
    // Teams store
    const teamsStore = db.createObjectStore('teams', { keyPath: 'id' });
    teamsStore.createIndex('by-name', 'name');

    // Players store
    const playersStore = db.createObjectStore('players', { keyPath: 'id' });
    playersStore.createIndex('by-team', 'team_id');
    playersStore.createIndex('by-name', 'name');

    // Pending actions store for offline support
    db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
  },
});

export async function syncTeams(teams: Team[]) {
  const tx = db.transaction('teams', 'readwrite');
  await Promise.all([
    ...teams.map(team => tx.store.put(team)),
    tx.done
  ]);
}

export async function syncPlayers(players: Player[]) {
  const tx = db.transaction('players', 'readwrite');
  await Promise.all([
    ...players.map(player => tx.store.put(player)),
    tx.done
  ]);
}

export async function getTeams(): Promise<Team[]> {
  return db.getAllFromIndex('teams', 'by-name');
}

export async function getTeamPlayers(teamId: string): Promise<Player[]> {
  return db.getAllFromIndex('players', 'by-team', teamId);
}

export async function addPendingAction(
  action: 'create' | 'update' | 'delete',
  table: 'teams' | 'players',
  data: any
) {
  await db.add('pendingActions', {
    action,
    table,
    data,
    timestamp: Date.now()
  });
}

export async function processPendingActions() {
  const pendingActions = await db.getAll('pendingActions');
  // Process actions in order
  for (const action of pendingActions) {
    try {
      // Implement sync logic here when online
      await db.delete('pendingActions', action.id);
    } catch (error) {
      console.error('Failed to process pending action:', error);
    }
  }
}