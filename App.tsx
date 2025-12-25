
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './state/authStore';
import { useMovieStore } from './state/movieStore';
import { useSocialStore } from './state/socialStore';
import { Layout } from './ui/layout/Layout';
import { Dashboard } from './ui/pages/Dashboard';
import { Login } from './ui/pages/Login';
import { MovieDetail } from './ui/pages/MovieDetail';
import { Lists } from './ui/pages/Lists';
import { Social } from './ui/pages/Social';
import { FriendProfile } from './ui/pages/FriendProfile';
import { MyProfile } from './ui/pages/MyProfile';
import { ChallengeGame } from './ui/pages/ChallengeGame';
import { SystemLogOverlay } from './ui/components/SystemLogOverlay';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore();
  
  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0f1115]">
      <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
  
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const { initialize, user } = useAuthStore();
  const { fetchData } = useMovieStore();
  const { fetchSocial } = useSocialStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Priority Sync on Visibility Change (Cross-device reliability)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        // Trigger immediate background sync when user returns to app
        fetchData(user.id, true);
        fetchSocial(user.id, true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [user?.id, fetchData, fetchSocial]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="movie/:id" element={<MovieDetail />} />
          <Route path="lists/:status" element={<Lists />} />
          <Route path="social" element={<Social />} />
          <Route path="social/friend/:id" element={<FriendProfile />} />
          <Route path="social/challenge/:id" element={<ChallengeGame />} />
          <Route path="profile" element={<MyProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SystemLogOverlay />
    </Router>
  );
};

export default App;
