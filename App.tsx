
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './state/authStore';
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
  
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
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
