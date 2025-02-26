import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Users,
  Trophy,
  TrendingUp,
  Award,
  User,
  Calendar,
  MapPin,
  Edit,
  Save,
  X,
  Plus,
  UserPlus,
  Star,
  Settings,
  Search,
  Upload
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const TeamDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    shortName: '',
    homeGround: '',
    foundedYear: '',
    maxSquadSize: 25,
    logoFile: null as File | null,
    logoUrl: ''
  });
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canManageTeam = user?.role === 'super_admin' || user?.role === 'admin' || 
    (user?.role === 'team_manager' && team?.created_by === user.id);

  useEffect(() => {
    fetchTeamData();
  }, [id]);

  const fetchTeamData = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          *,
          team_players!inner (
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
            is_vice_captain,
            jersey_number
          )
        `)
        .eq('id', id)
        .single();

      if (teamError) throw teamError;

      const transformedTeam = {
        ...teamData,
        players: teamData.team_players.map((tp: any) => ({
          ...tp.player,
          is_captain: tp.is_captain,
          is_vice_captain: tp.is_vice_captain,
          jersey_number: tp.jersey_number
        }))
      };

      setTeam(transformedTeam);
      setEditForm({
        name: transformedTeam.name,
        shortName: transformedTeam.short_name,
        homeGround: transformedTeam.home_ground,
        foundedYear: transformedTeam.founded_year.toString(),
        maxSquadSize: transformedTeam.max_squad_size,
        logoFile: null,
        logoUrl: transformedTeam.logo_url
      });
    } catch (err) {
      console.error('Error fetching team data:', err);
      setError('Failed to load team data');
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

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      let logoUrl = team.logo_url;
      if (editForm.logoFile) {
        const newLogoUrl = await handleLogoUpload(editForm.logoFile);
        if (newLogoUrl) {
          logoUrl = newLogoUrl;
        }
      }

      const { error } = await supabase
        .from('teams')
        .update({
          name: editForm.name,
          short_name: editForm.shortName,
          home_ground: editForm.homeGround,
          founded_year: parseInt(editForm.foundedYear),
          max_squad_size: editForm.maxSquadSize,
          logo_url: logoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', team.id);

      if (error) throw error;

      await fetchTeamData();
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Team updated successfully' });
    } catch (error) {
      console.error('Error updating team:', error);
      setMessage({ type: 'error', text: 'Failed to update team' });
    }
  };

  const fetchAvailablePlayers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          role,
          batting_style,
          bowling_style,
          jersey_number,
          profile_photo_url,
          team_players!left (
            team_id
          )
        `)
        .ilike('name', `%${searchTerm}%`)
        .order('name');

      if (error) throw error;

      const availablePlayers = data?.filter(player => 
        !player.team_players?.some(tp => tp.team_id)
      ) || [];

      setAvailablePlayers(availablePlayers);
    } catch (error) {
      console.error('Error fetching available players:', error);
      setMessage({ type: 'error', text: 'Failed to fetch available players' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showAddPlayer) {
      fetchAvailablePlayers();
    }
  }, [showAddPlayer, searchTerm]);

  const handleAddPlayers = async () => {
    try {
      const promises = selectedPlayers.map(playerId => (
        supabase
          .from('team_players')
          .insert({
            team_id: team.id,
            player_id: playerId,
            jersey_number: null,
            status: 'active'
          })
      ));

      await Promise.all(promises);
      await fetchTeamData();
      setShowAddPlayer(false);
      setSelectedPlayers([]);
      setMessage({ type: 'success', text: 'Players added successfully' });
    } catch (error) {
      console.error('Error adding players:', error);
      setMessage({ type: 'error', text: 'Failed to add players' });
    }
  };

  const handleUpdatePlayerRole = async (playerId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('team_players')
        .update(updates)
        .eq('team_id', team.id)
        .eq('player_id', playerId);

      if (error) throw error;

      await fetchTeamData();
      setMessage({ type: 'success', text: 'Player role updated successfully' });
    } catch (error) {
      console.error('Error updating player role:', error);
      setMessage({ type: 'error', text: 'Failed to update player role' });
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('team_players')
        .delete()
        .eq('team_id', team.id)
        .eq('player_id', playerId);

      if (error) throw error;

      await fetchTeamData();
      setMessage({ type: 'success', text: 'Player removed successfully' });
    } catch (error) {
      console.error('Error removing player:', error);
      setMessage({ type: 'error', text: 'Failed to remove player' });
    }
  };

  const renderAddPlayersModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add Players to Team</h2>
          <button
            onClick={() => {
              setShowAddPlayer(false);
              setSelectedPlayers([]);
              setSearchTerm('');
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search players..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : availablePlayers.length > 0 ? (
            availablePlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedPlayers.includes(player.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlayers([...selectedPlayers, player.id]);
                      } else {
                        setSelectedPlayers(selectedPlayers.filter(id => id !== player.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex items-center space-x-3">
                    {player.profile_photo_url ? (
                      <img
                        src={player.profile_photo_url}
                        alt={player.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-sm text-gray-600">
                        {player.role} • {player.batting_style?.replace(/_/g, ' ')}
                        {player.bowling_style && ` • ${player.bowling_style.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                  </div>
                </div>
                {player.jersey_number && (
                  <span className="text-sm text-gray-600">#{player.jersey_number}</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">
              No players found
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => {
              setShowAddPlayer(false);
              setSelectedPlayers([]);
              setSearchTerm('');
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleAddPlayers}
            disabled={selectedPlayers.length === 0}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Selected Players ({selectedPlayers.length})
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error || 'Team not found'}</p>
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

      <div className="bg-white rounded-lg shadow-md p-6">
        {isEditing ? (
          <form onSubmit={handleUpdateTeam} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Team Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Short Name</label>
                <input
                  type="text"
                  value={editForm.shortName}
                  onChange={(e) => setEditForm({ ...editForm, shortName: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Home Ground</label>
                <input
                  type="text"
                  value={editForm.homeGround}
                  onChange={(e) => setEditForm({ ...editForm, homeGround: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Founded Year</label>
                <input
                  type="number"
                  value={editForm.foundedYear}
                  onChange={(e) => setEditForm({ ...editForm, foundedYear: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Squad Size</label>
                <input
                  type="number"
                  value={editForm.maxSquadSize}
                  onChange={(e) => setEditForm({ ...editForm, maxSquadSize: parseInt(e.target.value) })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  min="11"
                  max="30"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Team Logo</label>
              <div className="mt-1 flex items-center space-x-4">
                {editForm.logoFile ? (
                  <div className="relative w-24 h-24">
                    <img
                      src={URL.createObjectURL(editForm.logoFile)}
                      alt="Logo preview"
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, logoFile: null })}
                      className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : team.logo_url ? (
                  <div className="relative w-24 h-24">
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  </div>
                ) : null}
                <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <span className="flex items-center">
                    <Upload className="h-5 w-5 mr-2" />
                    {editForm.logoFile || team.logo_url ? 'Change Logo' : 'Upload Logo'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setEditForm({ ...editForm, logoFile: file });
                      }
                    }}
                  />
                </label>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Recommended: Square image, at least 200x200 pixels
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
                <p className="text-gray-600">{team.short_name}</p>
              </div>
            </div>
            {canManageTeam && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                <Edit className="w-5 h-5 mr-2" />
                Edit Team
              </button>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center text-gray-600">
            <MapPin className="w-5 h-5 mr-2" />
            <span>{team.home_ground}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Calendar className="w-5 h-5 mr-2" />
            <span>Founded {team.founded_year}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Users className="w-5 h-5 mr-2" />
            <span>{team.players?.length || 0} players</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h2 className="text-lg font-semibold">Matches</h2>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Played</span>
              <span className="font-semibold">{team.team_stats?.matches_played || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Won</span>
              <span className="font-semibold">{team.team_stats?.matches_won || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Lost</span>
              <span className="font-semibold">{team.team_stats?.matches_lost || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <h2 className="text-lg font-semibold">Performance</h2>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Win Rate</span>
              <span className="font-semibold">
                {team.team_stats?.matches_played
                  ? Math.round((team.team_stats.matches_won / team.team_stats.matches_played) * 100)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Draw Rate</span>
              <span className="font-semibold">
                {team.team_stats?.matches_played
                  ? Math.round((team.team_stats.matches_drawn / team.team_stats.matches_played) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Award className="w-6 h-6 text-purple-500" />
            <h2 className="text-lg font-semibold">Achievements</h2>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tournaments</span>
              <span className="font-semibold">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Titles</span>
              <span className="font-semibold">0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Players</h2>
          {canManageTeam && (
            <button
              onClick={() => setShowAddPlayer(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add Players
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {team.players?.map((player: any) => (
            <div
              key={player.id}
              className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex-shrink-0">
                {player.profile_photo_url ? (
                  <img
                    src={player.profile_photo_url}
                    alt={player.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{player.name}</h3>
                    <p className="text-sm text-gray-600">
                      {player.role} • #{player.jersey_number}
                    </p>
                    <p className="text-sm text-gray-500">
                      {player.batting_style && `${player.batting_style.replace(/_/g, ' ')} bat`}
                      {player.bowling_style && ` • ${player.bowling_style.replace(/_/g, ' ')}`}
                    </p>
                  </div>
                  {canManageTeam && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUpdatePlayerRole(player.id, { is_captain: !player.is_captain })}
                        className={`p-1 rounded-full ${
                          player.is_captain ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        } hover:bg-yellow-200`}
                        title={player.is_captain ? 'Remove as Captain' : 'Make Captain'}
                      >
                        <Star className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRemovePlayer(player.id)}
                        className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                        title="Remove Player"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddPlayer && renderAddPlayersModal()}
    </div>
  );
};

export default TeamDetails;