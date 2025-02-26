import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import {
  Circle,
  Square,
  X,
  RotateCcw,
  Plus,
  Minus,
  AlertCircle,
  Target,
  Dot,
  Ban,
  CornerUpRight,
  Undo2,
  RefreshCw,
  User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const ScoringInterface = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [match, setMatch] = useState<any>(null);
  const [currentInnings, setCurrentInnings] = useState<any>(null);
  const [currentBatsmen, setCurrentBatsmen] = useState<any[]>([]);
  const [currentBowler, setCurrentBowler] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scoring state
  const [runs, setRuns] = useState(0);
  const [extras, setExtras] = useState({
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0
  });
  const [wicketType, setWicketType] = useState<string | null>(null);
  const [recentBalls, setRecentBalls] = useState<any[]>([]);

  useEffect(() => {
    fetchMatchData();
  }, [id]);

  const fetchMatchData = async () => {
    try {
      // First get the match and innings data
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          team1:teams!team1_id(*),
          team2:teams!team2_id(*),
          match_innings(
            *,
            batting_team:teams!batting_team_id(*),
            bowling_team:teams!bowling_team_id(*)
          )
        `)
        .eq('id', id)
        .single();

      if (matchError) throw matchError;
      setMatch(matchData);

      // Get current innings
      if (matchData.match_innings?.length > 0) {
        const currentInnings = matchData.match_innings[0];
        setCurrentInnings(currentInnings);

        // Get current batsmen with explicit relationship paths
        const { data: batsmenData, error: batsmenError } = await supabase
          .from('match_batsmen')
          .select(`
            *,
            player:players!match_batsmen_player_id_fkey(*)
          `)
          .eq('innings_id', currentInnings.id)
          .eq('is_out', false)
          .order('batting_position', { ascending: true });

        if (batsmenError) throw batsmenError;
        setCurrentBatsmen(batsmenData || []);

        // Get current bowler
        const { data: bowlerData, error: bowlerError } = await supabase
          .from('match_bowlers')
          .select(`
            *,
            player:players(*)
          `)
          .eq('innings_id', currentInnings.id)
          .eq('is_current_bowler', true)
          .single();

        if (bowlerError && bowlerError.code !== 'PGRST116') throw bowlerError;
        setCurrentBowler(bowlerData);

        // Get recent balls
        const { data: ballsData, error: ballsError } = await supabase
          .from('balls')
          .select('*')
          .eq('innings_id', currentInnings.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (ballsError) throw ballsError;
        setRecentBalls(ballsData || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const handleRunsClick = (value: number) => {
    setRuns(value);
    setWicketType(null);
    setExtras({ wides: 0, noBalls: 0, byes: 0, legByes: 0 });
  };

  const handleExtrasClick = (type: 'wides' | 'noBalls' | 'byes' | 'legByes') => {
    setExtras(prev => ({
      ...prev,
      [type]: prev[type] === 1 ? 0 : 1
    }));
    setWicketType(null);
  };

  const handleWicketClick = () => {
    setWicketType(wicketType ? null : 'bowled');
    setRuns(0);
    setExtras({ wides: 0, noBalls: 0, byes: 0, legByes: 0 });
  };

  const handleScoreSubmit = async () => {
    if (!currentInnings || !currentBatsmen.find(b => b.is_striker) || !currentBowler) {
      setError('Missing required match information');
      return;
    }

    try {
      const striker = currentBatsmen.find(b => b.is_striker);
      
      // Create ball record
      const ballData = {
        match_id: id,
        innings_id: currentInnings.id,
        over_number: Math.floor(currentInnings.overs),
        ball_number: ((currentInnings.overs % 1) * 10) + 1,
        batsman_id: striker.player_id,
        bowler_id: currentBowler.player_id,
        runs,
        extras: {
          wides: extras.wides,
          no_balls: extras.noBalls,
          byes: extras.byes,
          leg_byes: extras.legByes
        },
        wicket_type: wicketType,
        is_valid_ball: !extras.wides && !extras.noBalls
      };

      const { error: ballError } = await supabase
        .from('balls')
        .insert(ballData);

      if (ballError) throw ballError;

      // Reset scoring state
      setRuns(0);
      setExtras({ wides: 0, noBalls: 0, byes: 0, legByes: 0 });
      setWicketType(null);

      // Refresh match data
      await fetchMatchData();
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to submit score');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error || 'Match not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Match Info Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">{match?.team1.name} vs {match?.team2.name}</h1>
              <div className="text-sm text-gray-600">
                {match?.type} • {match?.venue}
              </div>
            </div>
            <button 
              onClick={fetchMatchData}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="Refresh Data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Current Innings Info */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">
                {currentInnings?.batting_team?.name || 'Loading...'}
              </h2>
              <div className="text-xl">
                {currentInnings?.total_runs || 0}-{currentInnings?.total_wickets || 0}
              </div>
              <div className="text-sm text-gray-600">
                Overs: {currentInnings?.overs || 0}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm">
                CRR: {currentInnings?.current_run_rate?.toFixed(2) || 0}
              </div>
              {currentInnings?.target && (
                <div className="text-sm">
                  Target: {currentInnings.target}
                  <br />
                  RRR: {currentInnings.required_run_rate?.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Batsmen and Bowler Info */}
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Batsmen */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Batting</h3>
            <div className="space-y-2">
              {currentBatsmen.map((batsman) => (
                <div key={batsman.id} className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {batsman.player.name} {batsman.is_striker ? '*' : ''}
                    </div>
                    <div className="text-sm text-gray-600">
                      {batsman.is_striker ? '(Striker)' : '(Non-striker)'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{batsman.runs_scored} ({batsman.balls_faced})</div>
                    <div className="text-sm text-gray-600">
                      SR: {batsman.strike_rate?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              ))}
              {currentBatsmen.length === 0 && (
                <div className="text-gray-500 text-center py-2">
                  No batsmen data available
                </div>
              )}
            </div>
          </div>

          {/* Bowler */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Bowling</h3>
            {currentBowler ? (
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{currentBowler.player.name}</div>
                  <div className="text-sm text-gray-600">
                    {currentBowler.overs} overs, {currentBowler.maidens} maidens
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{currentBowler.wickets}/{currentBowler.runs_conceded}</div>
                  <div className="text-sm text-gray-600">
                    Econ: {currentBowler.economy_rate?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-2">
                No bowler data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scoring Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="container mx-auto px-4 py-4">
          {/* Recent Balls */}
          <div className="flex space-x-2 overflow-x-auto pb-4">
            {recentBalls.map((ball) => (
              <div
                key={ball.id}
                className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${ball.wicket_type ? 'bg-red-100 text-red-800' :
                    ball.extras ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'}
                `}
              >
                {ball.wicket_type ? 'W' :
                  ball.extras ? 'E' :
                  ball.runs}
              </div>
            ))}
          </div>

          {/* Runs Buttons */}
          <div className="grid grid-cols-6 gap-2 mb-4">
            {[0, 1, 2, 3, 4, 6].map(run => (
              <button
                key={run}
                onClick={() => handleRunsClick(run)}
                className={`
                  p-4 text-lg font-semibold rounded-lg
                  ${runs === run ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}
                `}
              >
                {run}
              </button>
            ))}
          </div>

          {/* Extras and Special Deliveries */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => handleExtrasClick('legByes')}
              className={`p-3 rounded-lg ${extras.legByes ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              LB
            </button>
            <button
              onClick={() => handleExtrasClick('byes')}
              className={`p-3 rounded-lg ${extras.byes ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              Bye
            </button>
            <button
              onClick={() => handleExtrasClick('wides')}
              className={`p-3 rounded-lg ${extras.wides ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              Wide
            </button>
            <button
              onClick={() => handleExtrasClick('noBalls')}
              className={`p-3 rounded-lg ${extras.noBalls ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              NB
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => {}}
              className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              <CornerUpRight className="w-5 h-5 mx-auto" />
              <span className="text-sm">Ov.Thrw</span>
            </button>
            <button
              onClick={() => {}}
              className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              <Ban className="w-5 h-5 mx-auto" />
              <span className="text-sm">Penalty</span>
            </button>
            <button
              onClick={handleWicketClick}
              className={`p-3 rounded-lg ${wicketType ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <X className="w-5 h-5 mx-auto" />
              <span className="text-sm">Out</span>
            </button>
            <button
              onClick={() => {}}
              className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              <Undo2 className="w-5 h-5 mx-auto" />
              <span className="text-sm">Undo</span>
            </button>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleScoreSubmit}
            disabled={!currentBatsmen.length || !currentBowler}
            className="w-full mt-4 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
          >
            Submit Ball
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoringInterface;