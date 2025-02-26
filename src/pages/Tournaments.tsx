import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  MapPin,
  ChevronRight,
  Edit,
  Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const Tournaments = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .order('start_date', { ascending: true });

        if (error) throw error;
        setTournaments(data || []);
      } catch (error) {
        console.error('Error fetching tournaments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  const canManageTournament = user?.role === 'super_admin' || user?.role === 'admin';

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
        <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
        {canManageTournament && (
          <button
            onClick={() => navigate('/tournaments/new')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Tournament
          </button>
        )}
      </div>

      {tournaments.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center space-x-3 mb-4">
                {tournament.logo_url ? (
                  <img
                    src={tournament.logo_url}
                    alt={tournament.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <Trophy className="w-8 h-8 text-blue-500" />
                )}
                <h2 className="text-xl font-semibold">{tournament.name}</h2>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>
                    {format(new Date(tournament.start_date), 'PPP')} - {format(new Date(tournament.end_date), 'PPP')}
                  </span>
                </div>
                
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  <span>{tournament.team_count || 0} Teams</span>
                </div>
                
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span>{tournament.location}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <span className={`
                  px-2 py-1 text-sm rounded-full
                  ${tournament.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                    tournament.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'}
                `}>
                  {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                </span>
                <div className="flex space-x-2">
                  {canManageTournament && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/tournaments/${tournament.id}/edit`);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                      title="Edit Tournament"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/tournaments/${tournament.id}`);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View Details"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No tournaments found</p>
          {canManageTournament && (
            <button
              onClick={() => navigate('/tournaments/new')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create First Tournament
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Tournaments;