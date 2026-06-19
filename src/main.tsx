import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App, { AuthProvider, AuthContext } from '../App';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PublicQuoteView from './pages/PublicQuoteView';
import NotFoundPage from './pages/NotFoundPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppWrapper() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/preventivo/:shareToken" element={<PublicQuoteView />} />
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

ReactDOM.createRoot(document.getElementById('root')!).render(<AppWrapper />);
