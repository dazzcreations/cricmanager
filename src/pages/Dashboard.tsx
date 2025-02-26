import React, { useEffect, useState } from 'react';
import { Activity, Calendar, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const Dashboard = () => {
  const [stats, setStats] = useState({
    liveMatches: 0,
    upcomingMatches: 0,
    activeTeams: 0,
  });
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch live matches count
        const { count: liveCount } = await supabase
          .from('matches')
          .select('*', { count: 'exact' })
          .eq('status', 'live');

        // Fetch upcoming matches count
        const { count: upcomingCount } = await supabase
          .from('matches')
          .select('*', { count: 'exact' })
          .eq('status', 'upcoming');

        // Fetch active teams count
        const { count: teamsCount } = await supabase
          .from('teams')
          .select('*', { count: 'exact' });

        // Fetch recent matches
        const { data: recentMatchesData } = await supabase
          .from('matches')
          .select(`
            *,
            team1:teams!team1_id(name),
            team2:teams!team2_id(name),
            innings(total_runs, total_wickets)
          `)
          .order('date', { ascending: false })
          .limit(5);

        setStats({
          liveMatches: liveCount || 0,
          upcomingMatches: upcomingCount || 0,
          activeTeams: teamsCount || 0,
        });
        setRecentMatches(recentMatchesData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Set up real-time subscription for live updates
    const matchesSubscription = supabase
      .channel('dashboard-matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches'
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      matchesSubscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dhriaan Tournament Management System</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-blue-500" />
            <h2 className="text-xl font-semibold">Live Matches</h2>
          </div>
          <p className="mt-2 text-3xl font-bold">{stats.liveMatches}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-3">
            <Calendar className="w-8 h-8 text-green-500" />
            <h2 className="text-xl font-semibold">Upcoming Matches</h2>
          </div>
          <p className="mt-2 text-3xl font-bold">{stats.upcomingMatches}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8 text-purple-500" />
            <h2 className="text-xl font-semibold">Active Teams</h2>
          </div>
          <p className="mt-2 text-3xl font-bold">{stats.activeTeams}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Matches</h2>
        <div className="space-y-4">
          {recentMatches.length > 0 ? (
            recentMatches.map((match) => (
              <div key={match.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {match.team1.name} vs {match.team2.name}
                  </span>
                  <span className="text-gray-500">
                    {format(new Date(match.date), 'PPp')}
                  </span>
                </div>
                {match.innings && match.innings[0] && (
                  <p className="text-gray-600 mt-1">
                    {match.innings[0].total_runs}/{match.innings[0].total_wickets}
                  </p>
                )}
                <span className={`
                  inline-block mt-2 px-2 py-1 text-sm rounded-full
                  ${match.status === 'live' ? 'bg-green-100 text-green-800' : 
                    match.status === 'upcoming' ? 'bg-blue-100 text-blue-800' : 
                    'bg-gray-100 text-gray-800'}
                `}>
                  {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No recent matches</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;