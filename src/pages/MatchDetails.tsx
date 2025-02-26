import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import {
  Trophy,
  MapPin,
  Calendar,
  Activity,
  Users,
  Clock,
  ChevronRight,
  Play
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';
import type { Match, Innings } from '../types';

const MatchDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [match, setMatch] = useState<Match | null>(null);
  const [currentInnings, setCurrentInnings] = useState<Innings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select(`
            *,
            team1:teams!team1_id(*),
            team2:teams!team2_id(*),
            innings(*)
          `)
          .eq('id', id)
          .single();

        if (matchError) throw matchError;

        setMatch(matchData);
        if (matchData.innings?.length > 0) {
          setCurrentInnings(matchData.innings[matchData.innings.length - 1]);
        }
      } catch (err) {
        setError('Failed to load match data');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatchData();

    const matchSubscription = supabase
      .channel(`match:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${id}`
        },
        (payload) => {
          setMatch(payload.new as Match);
        }
      )
      .subscribe();

    return () => {
      matchSubscription.unsubscribe();
    };
  }, [id]);

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
        <p className="text-red-500">{error || 'Match not found'}</p>
      </div>
    );
  }

  const canScore = user?.role === 'scorer' || user?.role === 'admin' || user?.role === 'super_admin';
  const isLive = match.status === 'live';
  const isUpcoming = match.status === 'upcoming';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Match Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {match.team1.name} vs {match.team2.name}
            </h1>
            <div className="mt-2 space-y-2">
              <div className="flex items-center text-gray-600">
                <Trophy className="w-5 h-5 mr-2" />
                <span>{match.type}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <MapPin className="w-5 h-5 mr-2" />
                <span>{match.venue}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-2" />
                <span>{format(new Date(match.date), 'PPP')}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="w-5 h-5 mr-2" />
                <span>{format(new Date(match.date), 'p')}</span>
              </div>
            </div>
          </div>
          
          <div className="text-right space-y-2">
            <span className={`
              inline-block px-3 py-1 rounded-full text-sm font-medium
              ${match.status === 'live' ? 'bg-green-100 text-green-800' : 
                match.status === 'upcoming' ? 'bg-blue-100 text-blue-800' : 
                'bg-gray-100 text-gray-800'}
            `}>
              {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
            </span>
            
            {canScore && (
              <div className="flex flex-col space-y-2">
                {isLive && (
                  <button
                    onClick={() => navigate(`/matches/${match.id}/score`)}
                    className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Activity className="w-5 h-5 mr-2" />
                    Score Match
                  </button>
                )}
                {isUpcoming && (
                  <button
                    onClick={() => navigate(`/matches/${match.id}/setup`)}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Match
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{match.team1.name}</h2>
            <Users className="w-6 h-6 text-blue-500" />
          </div>
          {/* Add team 1 players and stats here */}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{match.team2.name}</h2>
            <Users className="w-6 h-6 text-blue-500" />
          </div>
          {/* Add team 2 players and stats here */}
        </div>
      </div>

      {/* Innings Details */}
      {match.innings && match.innings.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Innings</h2>
          <div className="space-y-4">
            {match.innings.map((innings, index) => (
              <div
                key={innings.id}
                className="p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">
                      Innings {index + 1}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {innings.total_runs}/{innings.total_wickets}
                      {innings.overs > 0 && ` (${innings.overs} overs)`}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchDetails;