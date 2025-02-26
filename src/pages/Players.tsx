import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Award, TrendingUp, UserPlus } from 'lucide-react';
import { useSelector } from 'react-redux';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const Players = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select(`
            *,
            team_players:team_players (
              team:teams (
                id,
                name,
                short_name
              ),
              is_captain,
              is_vice_captain,
              jersey_number
            )
          `)
          .order('name');

        if (error) throw error;

        // Transform the data to include team information
        const transformedPlayers = data?.map(player => ({
          ...player,
          teams: (player.team_players || []).map(tp => ({
            id: tp.team.id,
            name: tp.team.name,
            short_name: tp.team.short_name,
            is_captain: tp.is_captain,
            is_vice_captain: tp.is_vice_captain,
            jersey_number: tp.jersey_number
          }))
        }));

        setPlayers(transformedPlayers || []);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Players</h1>
        {user?.role === 'super_admin' && (
          <button
            onClick={() => navigate('/players/register')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Register New Player
          </button>
        )}
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <div key={player.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-4 mb-4">
              {player.profile_photo_url ? (
                <img
                  src={player.profile_photo_url}
                  alt={player.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-blue-500" />
              )}
              <div>
                <h2 className="text-xl font-semibold">{player.name}</h2>
                <div className="text-sm text-gray-600">
                  {player.teams.map((team, index) => (
                    <span key={team.id}>
                      {team.short_name}
                      {team.is_captain && ' (C)'}
                      {team.is_vice_captain && ' (VC)'}
                      {index < player.teams.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>Role</span>
                <span className="font-semibold capitalize">{player.role}</span>
              </div>
              {player.batting_style && (
                <div className="flex justify-between items-center text-sm">
                  <span>Batting Style</span>
                  <span className="font-semibold">{player.batting_style.replace('_', ' ')}</span>
                </div>
              )}
              {player.bowling_style && (
                <div className="flex justify-between items-center text-sm">
                  <span>Bowling Style</span>
                  <span className="font-semibold">{player.bowling_style.replace(/_/g, ' ')}</span>
                </div>
              )}
              {player.teams[0]?.jersey_number && (
                <div className="flex justify-between items-center text-sm">
                  <span>Jersey Number</span>
                  <span className="font-semibold">#{player.teams[0].jersey_number}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Players;