import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Users,
  Search,
  Plus,
  X,
  ChevronLeft,
  Star,
  Trophy,
  Calendar,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateSchedule } from '../lib/scheduleGenerator';
import type { RootState } from '../store';

const TournamentTeams = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scheduleOptions, setScheduleOptions] = useState({
    startDate: new Date().toISOString().split('T')[0],
    defaultTime: '14:00',
    matchDuration: 3,
    matchesPerDay: 2,
    venue: '',
    gameType: 'T20'
  });
  const [showScheduleOptions, setShowScheduleOptions] = useState(false);

  useEffect(() => {
    fetchTournamentData();
    fetchTeams();
  }, [id]);

  const fetchTournamentData = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_teams (
            team:teams (*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setTournament(data);
      setTeams(data.tournament_teams.map((tt: any) => tt.team));
      setScheduleOptions(prev => ({
        ...prev,
        venue: data.location || '',
        gameType: data.game_type || 'T20'
      }));
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setMessage({ type: 'error', text: 'Failed to load tournament data' });
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setMessage({ type: 'error', text: 'Failed to load teams' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeams = async () => {
    try {
      const { error } = await supabase
        .from('tournament_teams')
        .insert(
          selectedTeams.map(teamId => ({
            tournament_id: id,
            team_id: teamId
          }))
        );

      if (error) throw error;

      setMessage({ type: 'success', text: 'Teams added successfully' });
      fetchTournamentData();
      setSelectedTeams([]);
    } catch (error) {
      console.error('Error adding teams:', error);
      setMessage({ type: 'error', text: 'Failed to add teams' });
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    try {
      const { error } = await supabase
        .from('tournament_teams')
        .delete()
        .eq('tournament_id', id)
        .eq('team_id', teamId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Team removed successfully' });
      fetchTournamentData();
    } catch (error) {
      console.error('Error removing team:', error);
      setMessage({ type: 'error', text: 'Failed to remove team' });
    }
  };

  const handleGenerateSchedule = async () => {
    try {
      setLoading(true);

      // Validate required fields
      if (!scheduleOptions.startDate || !scheduleOptions.defaultTime || !scheduleOptions.venue) {
        throw new Error('Please fill in all schedule options');
      }

      // Generate matches
      const matches = generateSchedule(tournament.format, teams, {
        ...scheduleOptions,
        tournamentId: id // Add tournament ID to options
      });

      // Insert matches
      const { data: createdMatches, error: matchError } = await supabase
        .from('matches')
        .insert(matches)
        .select();

      if (matchError) throw matchError;

      // Create tournament_matches associations
      const { error: tournamentMatchError } = await supabase
        .from('tournament_matches')
        .insert(
          createdMatches.map(match => ({
            tournament_id: id,
            match_id: match.id,
            stage: 'group_stage',
            status: 'scheduled'
          }))
        );

      if (tournamentMatchError) throw tournamentMatchError;

      // Update tournament status
      const { error: tournamentError } = await supabase
        .from('tournaments')
        .update({ status: 'upcoming' })
        .eq('id', id);

      if (tournamentError) throw tournamentError;

      setMessage({ type: 'success', text: 'Schedule generated successfully' });
      navigate(`/tournaments/${id}`);
    } catch (error) {
      console.error('Error generating schedule:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to generate schedule'
      });
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/tournaments/${id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Tournament
        </button>
        <h1 className="text-2xl font-bold">Manage Teams</h1>
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

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Participating Teams ({teams.length})</h2>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setSelectedTeams([])}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Clear Selection
            </button>
            <button
              onClick={handleAddTeams}
              disabled={selectedTeams.length === 0}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Selected Teams
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center space-x-4">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={team.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{team.name}</h3>
                  <p className="text-sm text-gray-600">{team.players?.length || 0} Players</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveTeam(team.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                title="Remove Team"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}

          {teams.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No teams added yet
            </div>
          )}
        </div>

        {teams.length >= 2 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Generate Match Schedule</h3>
              <button
                onClick={() => setShowScheduleOptions(!showScheduleOptions)}
                className="text-blue-600 hover:text-blue-700"
              >
                {showScheduleOptions ? 'Hide Options' : 'Show Options'}
              </button>
            </div>

            {showScheduleOptions && (
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                      <input
                        type="date"
                        value={scheduleOptions.startDate}
                        onChange={(e) => setScheduleOptions({
                          ...scheduleOptions,
                          startDate: e.target.value
                        })}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Match Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                      <input
                        type="time"
                        value={scheduleOptions.defaultTime}
                        onChange={(e) => setScheduleOptions({
                          ...scheduleOptions,
                          defaultTime: e.target.value
                        })}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Match Duration (hours)
                    </label>
                    <input
                      type="number"
                      value={scheduleOptions.matchDuration}
                      onChange={(e) => setScheduleOptions({
                        ...scheduleOptions,
                        matchDuration: parseInt(e.target.value)
                      })}
                      min="1"
                      max="8"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Matches Per Day
                    </label>
                    <input
                      type="number"
                      value={scheduleOptions.matchesPerDay}
                      onChange={(e) => setScheduleOptions({
                        ...scheduleOptions,
                        matchesPerDay: parseInt(e.target.value)
                      })}
                      min="1"
                      max="4"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Venue
                    </label>
                    <input
                      type="text"
                      value={scheduleOptions.venue}
                      onChange={(e) => setScheduleOptions({
                        ...scheduleOptions,
                        venue: e.target.value
                      })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter default venue"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleGenerateSchedule}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Generate Schedule
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-6">Available Teams</h2>
        <div className="grid gap-4">
          {availableTeams
            .filter(team => !teams.find(t => t.id === team.id))
            .filter(team => 
              team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              team.short_name?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(team.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTeams([...selectedTeams, team.id]);
                      } else {
                        setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="text-sm text-gray-600">{team.players?.length || 0} Players</p>
                  </div>
                </div>
              </div>
            ))}

          {availableTeams.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No available teams found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentTeams;