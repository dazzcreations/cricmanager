import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Users,
  UserPlus,
  Edit,
  Save,
  X,
  Plus,
  MapPin,
  Calendar,
  Trophy,
  User,
  Upload,
  Image
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const Teams = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamForm, setNewTeamForm] = useState({
    name: '',
    shortName: '',
    homeGround: '',
    foundedYear: new Date().getFullYear().toString(),
    logoFile: null as File | null,
    logoUrl: ''
  });
  const [showNewTeamForm, setShowNewTeamForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_stats,
          team_players:team_players (
            player:players (
              id,
              name,
              role,
              batting_style,
              bowling_style,
              jersey_number,
              profile_photo_url
            ),
            is_captain,
            is_vice_captain
          )
        `)
        .order('name');

      if (error) throw error;

      // Transform the data to include players array
      const transformedTeams = data?.map(team => ({
        ...team,
        players: (team.team_players || []).map(tp => ({
          ...tp.player,
          is_captain: tp.is_captain,
          is_vice_captain: tp.is_vice_captain
        }))
      }));

      setTeams(transformedTeams || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setMessage({ type: 'error', text: 'Failed to load teams' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `team-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('team-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('team-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage({ type: 'error', text: 'Failed to upload team logo' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      let logoUrl = '';
      if (newTeamForm.logoFile) {
        logoUrl = await handleLogoUpload(newTeamForm.logoFile);
        if (!logoUrl) return;
      }

      const { data, error } = await supabase
        .from('teams')
        .insert({
          name: newTeamForm.name,
          short_name: newTeamForm.shortName,
          home_ground: newTeamForm.homeGround,
          founded_year: parseInt(newTeamForm.foundedYear),
          logo_url: logoUrl,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTeams();
      setShowNewTeamForm(false);
      setNewTeamForm({
        name: '',
        shortName: '',
        homeGround: '',
        foundedYear: new Date().getFullYear().toString(),
        logoFile: null,
        logoUrl: ''
      });
      setMessage({ type: 'success', text: 'Team created successfully' });
    } catch (error) {
      console.error('Error creating team:', error);
      setMessage({ type: 'error', text: 'Failed to create team' });
    }
  };

  const canManageTeams = user?.role === 'super_admin' || user?.role === 'admin';

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
        <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
        {canManageTeams && (
          <button
            onClick={() => setShowNewTeamForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Create Team
          </button>
        )}
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

      {showNewTeamForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Team</h2>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeamForm.name}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Royal Challengers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Short Name</label>
                <input
                  type="text"
                  required
                  value={newTeamForm.shortName}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, shortName: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., RCB"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Home Ground</label>
                <input
                  type="text"
                  required
                  value={newTeamForm.homeGround}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, homeGround: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., M. Chinnaswamy Stadium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Founded Year</label>
                <input
                  type="number"
                  required
                  min="1800"
                  max={new Date().getFullYear()}
                  value={newTeamForm.foundedYear}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, foundedYear: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Team Logo</label>
                <div className="mt-1 flex items-center space-x-4">
                  {newTeamForm.logoFile && (
                    <div className="relative w-24 h-24">
                      <img
                        src={URL.createObjectURL(newTeamForm.logoFile)}
                        alt="Logo preview"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNewTeamForm({ ...newTeamForm, logoFile: null })}
                        className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <span className="flex items-center">
                      <Upload className="h-5 w-5 mr-2" />
                      {newTeamForm.logoFile ? 'Change Logo' : 'Upload Logo'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewTeamForm({ ...newTeamForm, logoFile: file });
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Recommended: Square image, at least 200x200 pixels
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowNewTeamForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                <Save className="w-5 h-5 mr-2" />
                Create Team
              </button>
            </div>
          </form>
        </div>
      )}

      {teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/teams/${team.id}`)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold">{team.name}</h2>
                    <p className="text-sm text-gray-600">{team.short_name}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span>{team.home_ground}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Founded {team.founded_year}</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  <span>{team.players?.length || 0} Players</span>
                </div>
              </div>

              {team.players && team.players.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Key Players</h3>
                  <div className="flex -space-x-2 overflow-hidden">
                    {team.players.slice(0, 5).map((player) => (
                      <div
                        key={player.id}
                        className={`inline-block h-8 w-8 rounded-full ring-2 ring-white ${
                          player.is_captain ? 'ring-yellow-400' : ''
                        }`}
                      >
                        {player.profile_photo_url ? (
                          <img
                            src={player.profile_photo_url}
                            alt={player.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                      </div>
                    ))}
                    {team.players.length > 5 && (
                      <div className="inline-block h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                        +{team.players.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {team.team_stats && (
                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm text-gray-600">Played</div>
                    <div className="font-semibold">{team.team_stats.matches_played}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Won</div>
                    <div className="font-semibold">{team.team_stats.matches_won}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Win Rate</div>
                    <div className="font-semibold">
                      {team.team_stats.matches_played > 0
                        ? Math.round((team.team_stats.matches_won / team.team_stats.matches_played) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No teams found</p>
          {canManageTeams && !showNewTeamForm && (
            <button
              onClick={() => setShowNewTeamForm(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create First Team
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Teams;