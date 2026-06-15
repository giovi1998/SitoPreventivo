import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App, { AuthProvider, AuthContext } from '../App.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = React.useContext(AuthContext);
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>Caricamento...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppWrapper() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            <HomePageWrapper />
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function HomePageWrapper() {
  const { user } = React.useContext(AuthContext);
  return <HomePage user={user} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppWrapper />);
