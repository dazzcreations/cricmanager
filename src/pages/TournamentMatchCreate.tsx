import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Save,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const TournamentMatchCreate = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    team1Id: '',
    team2Id: '',
    venue: '',
    date: '',
    time: '',
    type: 'T20'
  });

  useEffect(() => {
    fetchTournamentData();
  }, [id]);

  const fetchTournamentData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_teams (
            team:teams (*)
          )
        `)
        .eq('id', id)
        .single();

      if (tournamentError) throw tournamentError;

      setTournament(tournamentData);
      setTeams(tournamentData.tournament_teams.map((tt: any) => tt.team));
      setFormData(prev => ({
        ...prev,
        type: tournamentData.game_type || 'T20',
        venue: tournamentData.location || ''
      }));
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setMessage({ type: 'error', text: 'Failed to load tournament data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Create the match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          tournament_id: id,
          type: formData.type,
          team1_id: formData.team1Id,
          team2_id: formData.team2Id,
          venue: formData.venue,
          date: new Date(`${formData.date}T${formData.time}`).toISOString(),
          status: 'upcoming'
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // Create tournament match record
      const { error: tournamentMatchError } = await supabase
        .from('tournament_matches')
        .insert({
          tournament_id: id,
          match_id: match.id
        });

      if (tournamentMatchError) throw tournamentMatchError;

      setMessage({ type: 'success', text: 'Match created successfully' });
      navigate(`/tournaments/${id}`);
    } catch (error) {
      console.error('Error creating match:', error);
      setMessage({ type: 'error', text: 'Failed to create match' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/tournaments/${id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Tournament
        </button>
        <h1 className="text-2xl font-bold">Create Tournament Match</h1>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Match Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="T20">T20</option>
            <option value="ODI">ODI</option>
            <option value="Test">Test</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team 1
            </label>
            <select
              value={formData.team1Id}
              onChange={(e) => setFormData({ ...formData, team1Id: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team 2
            </label>
            <select
              value={formData.team2Id}
              onChange={(e) => setFormData({ ...formData, team2Id: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option 
                  key={team.id} 
                  value={team.id}
                  disabled={team.id === formData.team1Id}
                >
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Venue
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter venue name"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(`/tournaments/${id}`)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            <Save className="w-5 h-5 mr-2" />
            Create Match
          </button>
        </div>
      </form>
    </div>
  );
};

export default TournamentMatchCreate;