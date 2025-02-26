import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Edit,
  Save,
  Upload,
  X,
  DollarSign,
  FileText,
  Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const TournamentDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEditTournament = user?.role === 'super_admin' || user?.role === 'admin';

  useEffect(() => {
    fetchTournamentData();
  }, [id]);

  const fetchTournamentData = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_teams (
            team:teams (
              *,
              players:team_players(*)
            )
          ),
          tournament_matches (
            match:matches (
              *,
              team1:teams!team1_id(*),
              team2:teams!team2_id(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setTournament(data);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setMessage({ type: 'error', text: 'Failed to load tournament data' });
    } finally {
      setLoading(false);
    }
  };

  const handleManageTeams = () => {
    navigate(`/tournaments/${id}/teams`);
  };

  const handleCreateMatch = () => {
    navigate(`/tournaments/${id}/matches/new`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Tournament not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tournament Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <div className="mt-2 space-y-2">
              <div className="flex items-center text-gray-600">
                <Trophy className="w-5 h-5 mr-2" />
                <span>{tournament.format.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <MapPin className="w-5 h-5 mr-2" />
                <span>{tournament.location}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-2" />
                <span>
                  {format(new Date(tournament.start_date), 'PPP')} - {format(new Date(tournament.end_date), 'PPP')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${tournament.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                tournament.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'}
            `}>
              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
            </span>
            {canEditTournament && (
              <button
                onClick={() => navigate(`/tournaments/${id}/edit`)}
                className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                <Settings className="w-4 h-4 mr-1" />
                Settings
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Teams Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Participating Teams</h2>
          {canEditTournament && (
            <button
              onClick={handleManageTeams}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              <Users className="w-5 h-5 mr-2" />
              Manage Teams
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournament.tournament_teams?.map((tt: any) => (
            <div
              key={tt.team.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center space-x-4">
                {tt.team.logo_url ? (
                  <img
                    src={tt.team.logo_url}
                    alt={tt.team.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{tt.team.name}</h3>
                  <p className="text-sm text-gray-600">{tt.team.players?.length || 0} Players</p>
                </div>
              </div>
            </div>
          ))}

          {!tournament.tournament_teams?.length && (
            <div className="col-span-2 text-center py-8 text-gray-500">
              No teams added yet
            </div>
          )}
        </div>
      </div>

      {/* Matches Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Tournament Matches</h2>
          {canEditTournament && tournament.tournament_teams?.length >= 2 && (
            <div className="flex space-x-2">
              <button
                onClick={handleManageTeams}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Generate Schedule
              </button>
              <button
                onClick={handleCreateMatch}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Create Match
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {tournament.tournament_matches?.map((tm: any) => (
            <div
              key={tm.match.id}
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => navigate(`/matches/${tm.match.id}`)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">
                    {tm.match.team1.name} vs {tm.match.team2.name}
                  </h3>
                  <div className="mt-1 text-sm text-gray-600">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {tm.match.venue}
                    </div>
                    <div className="flex items-center mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {format(new Date(tm.match.date), 'PPp')}
                    </div>
                  </div>
                </div>
                <span className={`
                  px-3 py-1 rounded-full text-sm font-medium
                  ${tm.match.status === 'live' ? 'bg-green-100 text-green-800' :
                    tm.match.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'}
                `}>
                  {tm.match.status.charAt(0).toUpperCase() + tm.match.status.slice(1)}
                </span>
              </div>
            </div>
          ))}

          {!tournament.tournament_matches?.length && (
            <div className="text-center py-8 text-gray-500">
              No matches scheduled yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentDetails;