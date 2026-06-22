import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import App, { AuthProvider, AuthContext } from '../App';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminRoute from '../src/components/AdminRoute';
import { EditorPage, CollectionPage, QrPage, CardPage, SettingsRoute, AdminPage } from './pages/app';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppWrapper() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="editor" replace />} />
            <Route path="editor" element={<EditorPage />} />
            <Route path="collection" element={<CollectionPage />} />
            <Route path="qr" element={<QrPage />} />
            <Route path="card" element={<CardPage />} />
            <Route path="settings" element={<SettingsRoute />} />
            <Route path="admin" element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            } />
            <Route path="*" element={<Navigate to="editor" replace />} />
          </Route>
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

void Outlet;

ReactDOM.createRoot(document.getElementById('root')!).render(<AppWrapper />);
