import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Star,
  Shield,
  Crosshair,
  ChevronLeft,
  Trophy,
  Check,
  AlertCircle,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Player {
  id: string;
  name: string;
  role: string;
  jersey_number: number;
  profile_photo_url?: string;
}

interface SelectedPlayer extends Player {
  isCaptain: boolean;
  isViceCaptain: boolean;
  isWicketKeeper: boolean;
}

const MatchSetup = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [match, setMatch] = useState<any>(null);
  const [team1Players, setTeam1Players] = useState<Player[]>([]);
  const [team2Players, setTeam2Players] = useState<Player[]>([]);
  const [selectedTeam1Players, setSelectedTeam1Players] = useState<SelectedPlayer[]>([]);
  const [selectedTeam2Players, setSelectedTeam2Players] = useState<SelectedPlayer[]>([]);
  const [tossWinner, setTossWinner] = useState<string>('');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const REQUIRED_PLAYERS = 11;

  useEffect(() => {
    if (id) {
      fetchMatchData();
    }
  }, [id]);

  const fetchMatchData = async () => {
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          team1:teams!team1_id(
            id,
            name,
            team_players(
              player:players(*)
            )
          ),
          team2:teams!team2_id(
            id,
            name,
            team_players(
              player:players(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (matchError) throw matchError;

      setMatch(matchData);
      setTeam1Players(matchData.team1.team_players.map((tp: any) => tp.player));
      setTeam2Players(matchData.team2.team_players.map((tp: any) => tp.player));
    } catch (error) {
      console.error('Error fetching match data:', error);
      setError('Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAllTeam1 = () => {
    if (selectedTeam1Players.length === team1Players.length) {
      setSelectedTeam1Players([]);
    } else {
      setSelectedTeam1Players(
        team1Players.map(player => ({
          ...player,
          isCaptain: false,
          isViceCaptain: false,
          isWicketKeeper: false
        }))
      );
    }
  };

  const handleSelectAllTeam2 = () => {
    if (selectedTeam2Players.length === team2Players.length) {
      setSelectedTeam2Players([]);
    } else {
      setSelectedTeam2Players(
        team2Players.map(player => ({
          ...player,
          isCaptain: false,
          isViceCaptain: false,
          isWicketKeeper: false
        }))
      );
    }
  };

  const handlePlayerSelection = (
    player: Player,
    team: 'team1' | 'team2',
    selected: boolean
  ) => {
    const selectedPlayers = team === 'team1' ? selectedTeam1Players : selectedTeam2Players;
    const setSelectedPlayers = team === 'team1' ? setSelectedTeam1Players : setSelectedTeam2Players;

    if (selected) {
      if (selectedPlayers.length >= REQUIRED_PLAYERS) {
        return;
      }
      setSelectedPlayers([
        ...selectedPlayers,
        { ...player, isCaptain: false, isViceCaptain: false, isWicketKeeper: false }
      ]);
    } else {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
    }
  };

  const handleCaptainSelection = (
    playerId: string,
    team: 'team1' | 'team2',
    role: 'captain' | 'viceCaptain'
  ) => {
    const selectedPlayers = team === 'team1' ? selectedTeam1Players : selectedTeam2Players;
    const setSelectedPlayers = team === 'team1' ? setSelectedTeam1Players : setSelectedTeam2Players;

    setSelectedPlayers(
      selectedPlayers.map(player => {
        if (player.id === playerId) {
          // If selecting as captain, ensure player is not vice captain
          if (role === 'captain' && player.isViceCaptain) {
            return player;
          }
          // If selecting as vice captain, ensure player is not captain
          if (role === 'viceCaptain' && player.isCaptain) {
            return player;
          }
          return {
            ...player,
            isCaptain: role === 'captain' ? !player.isCaptain : player.isCaptain,
            isViceCaptain: role === 'viceCaptain' ? !player.isViceCaptain : player.isViceCaptain
          };
        }
        // Unset the role for other players
        return {
          ...player,
          isCaptain: role === 'captain' ? false : player.isCaptain,
          isViceCaptain: role === 'viceCaptain' ? false : player.isViceCaptain
        };
      })
    );
  };

  const handleWicketKeeperSelection = (
    playerId: string,
    team: 'team1' | 'team2'
  ) => {
    const selectedPlayers = team === 'team1' ? selectedTeam1Players : selectedTeam2Players;
    const setSelectedPlayers = team === 'team1' ? setSelectedTeam1Players : setSelectedTeam2Players;

    setSelectedPlayers(
      selectedPlayers.map(player => ({
        ...player,
        isWicketKeeper: player.id === playerId ? !player.isWicketKeeper : false
      }))
    );
  };

  const validateSquadSelection = () => {
    const validateTeam = (players: SelectedPlayer[]) => {
      const hasCaptain = players.some(p => p.isCaptain);
      const hasViceCaptain = players.some(p => p.isViceCaptain);
      const hasWicketKeeper = players.some(p => p.isWicketKeeper);
      const captainNotViceCaptain = !players.some(p => p.isCaptain && p.isViceCaptain);
      return players.length === REQUIRED_PLAYERS && 
             hasCaptain && 
             hasViceCaptain && 
             hasWicketKeeper && 
             captainNotViceCaptain;
    };

    return validateTeam(selectedTeam1Players) && validateTeam(selectedTeam2Players);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // First, check if match squads already exist
      const { data: existingSquads, error: checkError } = await supabase
        .from('match_squads')
        .select('id')
        .eq('match_id', id);

      if (checkError) throw checkError;

      if (existingSquads && existingSquads.length > 0) {
        // Delete existing squads
        const { error: deleteError } = await supabase
          .from('match_squads')
          .delete()
          .eq('match_id', id);

        if (deleteError) throw deleteError;
      }

      // Create match squad records
      const squadData = [
        ...selectedTeam1Players.map(player => ({
          match_id: id,
          team_id: match.team1.id,
          player_id: player.id,
          is_captain: player.isCaptain,
          is_vice_captain: player.isViceCaptain,
          is_wicket_keeper: player.isWicketKeeper,
          role: player.role
        })),
        ...selectedTeam2Players.map(player => ({
          match_id: id,
          team_id: match.team2.id,
          player_id: player.id,
          is_captain: player.isCaptain,
          is_vice_captain: player.isViceCaptain,
          is_wicket_keeper: player.isWicketKeeper,
          role: player.role
        }))
      ];

      const { error: squadError } = await supabase
        .from('match_squads')
        .insert(squadData);

      if (squadError) throw squadError;

      // Update match with toss details
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          toss_winner: tossWinner,
          toss_decision: tossDecision,
          status: 'live'
        })
        .eq('id', id);

      if (matchError) throw matchError;

      // Wait for the trigger to create the innings
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify innings was created
      const { data: innings, error: inningsError } = await supabase
        .from('match_innings')
        .select('*')
        .eq('match_id', id)
        .single();

      if (inningsError || !innings) {
        throw new Error('Failed to create innings');
      }

      // Redirect to scoring interface
      navigate(`/matches/${id}/score`);
    } catch (error) {
      console.error('Error saving match setup:', error);
      setError('Failed to save match setup');
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

  if (error || !match) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">{error || 'Match not found'}</p>
      </div>
    );
  }

  const renderSquadSelection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Team 1 Squad Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{match.team1.name}</h2>
          <button
            onClick={handleSelectAllTeam1}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {selectedTeam1Players.length === team1Players.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="space-y-4">
          {team1Players.map(player => {
            const isSelected = selectedTeam1Players.some(p => p.id === player.id);
            const selectedPlayer = selectedTeam1Players.find(p => p.id === player.id);

            return (
              <div
                key={player.id}
                className={`
                  flex items-center justify-between p-4 border rounded-lg
                  ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handlePlayerSelection(player, 'team1', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold">{player.name}</p>
                    <p className="text-sm text-gray-600">
                      {player.role} • #{player.jersey_number}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCaptainSelection(player.id, 'team1', 'captain')}
                      className={`p-1 rounded-full ${
                        selectedPlayer?.isCaptain
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={selectedPlayer?.isCaptain ? 'Captain' : 'Make Captain'}
                    >
                      <Star className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleCaptainSelection(player.id, 'team1', 'viceCaptain')}
                      className={`p-1 rounded-full ${
                        selectedPlayer?.isViceCaptain
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={selectedPlayer?.isViceCaptain ? 'Vice Captain' : 'Make Vice Captain'}
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleWicketKeeperSelection(player.id, 'team1')}
                      className={`p-1 rounded-full ${
                        selectedPlayer?.isWicketKeeper
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={selectedPlayer?.isWicketKeeper ? 'Wicket Keeper' : 'Make Wicket Keeper'}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Selected: {selectedTeam1Players.length}/{REQUIRED_PLAYERS} players
        </div>
      </div>

      {/* Team 2 Squad Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{match.team2.name}</h2>
          <button
            onClick={handleSelectAllTeam2}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {selectedTeam2Players.length === team2Players.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="space-y-4">
          {team2Players.map(player => {
            const isSelected = selectedTeam2Players.some(p => p.id === player.id);
            const selectedPlayer = selectedTeam2Players.find(p => p.id === player.id);

            return (
              <div
                key={player.id}
                className={`
                  flex items-center justify-between p-4 border rounded-lg
                  ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handlePlayerSelection(player, 'team2', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold">{player.name}</p>
                    <p className="text-sm text-gray-600">
                      {player.role} • #{player.jersey_number}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCaptainSelection(player.id, 'team2', 'captain')}
                      className={`p-1 rounded-full ${
                        selectedPlayer?.isCaptain
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={selectedPlayer?.isCaptain ? 'Captain' : 'Make Captain'}
                    >
                      <Star className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleCaptainSelection(player.id, 'team2', 'viceCaptain')}
                      className={`p-1 rounded-full ${
                        selectedPlayer?.isViceCaptain
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={selectedPlayer?.isViceCaptain ? 'Vice Captain' : 'Make Vice Captain'}
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleWicketKeeperSelection(player.id, 'team2')}
                      className={`p-1 rounded-full ${
                        selectedPlayer?.isWicketKeeper
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={selectedPlayer?.isWicketKeeper ? 'Wicket Keeper' : 'Make Wicket Keeper'}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Selected: {selectedTeam2Players.length}/{REQUIRED_PLAYERS} players
        </div>
      </div>
    </div>
  );

  const renderTossAndDecision = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-6">Toss and Decision</h2>
      
      <div className="space-y-6">
        {/* Toss Winner Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Toss Winner
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setTossWinner(match.team1.id)}
              className={`
                p-4 border rounded-lg text-center
                ${tossWinner === match.team1.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'hover:bg-gray-50'}
              `}
            >
              <Trophy className={`w-6 h-6 mx-auto mb-2 ${
                tossWinner === match.team1.id ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <p className="font-medium">{match.team1.name}</p>
            </button>
            <button
              onClick={() => setTossWinner(match.team2.id)}
              className={`
                p-4 border rounded-lg text-center
                ${tossWinner === match.team2.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'hover:bg-gray-50'}
              `}
            >
              <Trophy className={`w-6 h-6 mx-auto mb-2 ${
                tossWinner === match.team2.id ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <p className="font-medium">{match.team2.name}</p>
            </button>
          </div>
        </div>

        {/* Toss Decision */}
        {tossWinner && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {match.team1.id === tossWinner ? match.team1.name : match.team2.name} elected to
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTossDecision('bat')}
                className={`
                  p-4 border rounded-lg text-center
                  ${tossDecision === 'bat'
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-50'}
                `}
              >
                <Crosshair className={`w-6 h-6 mx-auto mb-2 ${
                  tossDecision === 'bat' ? 'text-blue-500' : 'text-gray-400'
                }`} />
                <p className="font-medium">Bat</p>
              </button>
              <button
                onClick={() => setTossDecision('bowl')}
                className={`
                  p-4 border rounded-lg text-center
                  ${tossDecision === 'bowl'
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-50'}
                `}
              >
                <Crosshair className={`w-6 h-6 mx-auto mb-2 ${
                  tossDecision === 'bowl' ? 'text-blue-500' : 'text-gray-400'
                }`} />
                <p className="font-medium">Bowl</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/matches/${id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Match
        </button>
        <h1 className="text-2xl font-bold">Match Setup</h1>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-between">
          <div className={`flex flex-col items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <Users className="w-6 h-6" />
            <span className="text-sm mt-1">Squad Selection</span>
          </div>
          <div className={`flex flex-col items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <Trophy className="w-6 h-6" />
            <span className="text-sm mt-1">Toss & Decision</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-6">
        {currentStep === 1 ? renderSquadSelection() : renderTossAndDecision()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(step => Math.max(1, step - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
        >
          Previous
        </button>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate(`/matches/${id}`)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          {currentStep < 2 ? (
            <button
              onClick={() => setCurrentStep(step => Math.min(2, step + 1))}
              disabled={!validateSquadSelection()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!tossWinner || !tossDecision || loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
            >
              <Check className="w-5 h-5 mr-2" />
              Start Match
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchSetup;