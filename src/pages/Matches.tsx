import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import {
  Trophy,
  Plus,
  Activity,
  Calendar,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';

const Matches = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [matches, setMatches] = useState({
    live: [],
    upcoming: [],
    completed: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select(`
            *,
            team1:teams!team1_id(name),
            team2:teams!team2_id(name),
            innings(
              total_runs,
              total_wickets,
              overs,
              batting_team_id,
              bowling_team_id
            )
          `)
          .order('date', { ascending: true });

        if (error) throw error;

        const categorizedMatches = (data || []).reduce((acc, match) => {
          acc[match.status].push(match);
          return acc;
        }, { live: [], upcoming: [], completed: [] });

        setMatches(categorizedMatches);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();

    const matchesSubscription = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches'
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      matchesSubscription.unsubscribe();
    };
  }, []);

  // Update the permission check to include super_admin
  const canCreateMatch = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'scorer';
  const canScore = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'scorer';

  const renderMatchCard = (match) => {
    const currentInnings = match.innings?.[match.innings.length - 1];
    
    return (
      <div
        key={match.id}
        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => navigate(`/matches/${match.id}`)}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {match.team1.name} vs {match.team2.name}
            </h3>
            <div className="flex items-center text-sm text-gray-600">
              <Trophy className="w-4 h-4 mr-1" />
              <span>{match.type}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-1" />
              <span>{match.venue}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="w-4 h-4 mr-1" />
              <span>{format(new Date(match.date), 'PPp')}</span>
            </div>
          </div>

          <div className="text-right">
            <span className={`
              inline-block px-3 py-1 rounded-full text-sm font-medium
              ${match.status === 'live' 
                ? 'bg-green-100 text-green-800' 
                : match.status === 'upcoming'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
              }
            `}>
              {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
            </span>

            {currentInnings && (
              <div className="mt-2 text-lg font-semibold">
                {currentInnings.total_runs}/{currentInnings.total_wickets}
                {currentInnings.overs > 0 && ` (${currentInnings.overs})`}
              </div>
            )}

            {canScore && match.status === 'live' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/matches/${match.id}/score`);
                }}
                className="mt-2 flex items-center justify-center w-full px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Activity className="w-4 h-4 mr-1" />
                Score Match
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
        {canCreateMatch && (
          <button
            onClick={() => navigate('/matches/new')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Match
          </button>
        )}
      </div>
      
      <div className="grid gap-6">
        {matches.live.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Live Matches</h2>
            <div className="grid gap-4">
              {matches.live.map(renderMatchCard)}
            </div>
          </div>
        )}

        {matches.upcoming.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Upcoming Matches</h2>
            <div className="grid gap-4">
              {matches.upcoming.map(renderMatchCard)}
            </div>
          </div>
        )}

        {matches.completed.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Completed Matches</h2>
            <div className="grid gap-4">
              {matches.completed.map(renderMatchCard)}
            </div>
          </div>
        )}

        {!matches.live.length && !matches.upcoming.length && !matches.completed.length && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No matches found</p>
            {canCreateMatch && (
              <button
                onClick={() => navigate('/matches/new')}
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create First Match
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches;