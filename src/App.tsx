import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch } from 'react-redux';
import { store } from './store';
import { setOnlineStatus } from './store/slices/teamsSlice';
import { getCurrentSession } from './store/slices/authSlice';
import { processPendingActions } from './lib/db';
import { setupRealtimeSubscriptions } from './lib/realtime';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import CreateMatch from './pages/CreateMatch';
import MatchDetails from './pages/MatchDetails';
import MatchSetup from './pages/MatchSetup';
import ScoringInterface from './pages/ScoringInterface';
import Teams from './pages/Teams';
import TeamDetails from './pages/TeamDetails';
import Players from './pages/Players';
import PlayerRegistration from './pages/PlayerRegistration';
import Tournaments from './pages/Tournaments';
import TournamentCreate from './pages/TournamentCreate';
import TournamentDetails from './pages/TournamentDetails';
import TournamentTeams from './pages/TournamentTeams';
import TournamentMatchCreate from './pages/TournamentMatchCreate';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import Login from './pages/Login';

function AppContent() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Get current session on app load
    dispatch(getCurrentSession());

    const handleOnline = () => {
      dispatch(setOnlineStatus(true));
      processPendingActions();
    };

    const handleOffline = () => {
      dispatch(setOnlineStatus(false));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const cleanup = setupRealtimeSubscriptions();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanup();
    };
  }, [dispatch]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/matches/new" element={<CreateMatch />} />
            <Route path="/matches/:id" element={<MatchDetails />} />
            <Route path="/matches/:id/setup" element={<MatchSetup />} />
            <Route path="/matches/:id/score" element={<ScoringInterface />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:id" element={<TeamDetails />} />
            <Route path="/players" element={<Players />} />
            <Route path="/players/register" element={<PlayerRegistration />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/new" element={<TournamentCreate />} />
            <Route path="/tournaments/:id" element={<TournamentDetails />} />
            <Route path="/tournaments/:id/edit" element={<TournamentDetails />} />
            <Route path="/tournaments/:id/teams" element={<TournamentTeams />} />
            <Route path="/tournaments/:id/ matches/new" element={<TournamentMatchCreate />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;