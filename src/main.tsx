import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import App, { AuthProvider, AuthContext } from '../App';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminRoute from '../src/components/AdminRoute';
import { EditorPage, CollectionPage, QrPage, CardPage, LogoPage, SettingsRoute, AdminPage } from './pages/app';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function IndexRedirect() {
  const { user } = React.useContext(AuthContext);
  // Admin → editor (preventivi), user normali → qr (entry point pratico)
  const target = user?.role === 'admin' ? 'editor' : 'qr';
  return <Navigate to={target} replace />;
}

function AdminEditorRoute({ children }: { children: React.ReactNode }) {
  const { user } = React.useContext(AuthContext);
  if (!user || user.role !== 'admin') {
    return <Navigate to="/app/qr" replace />;
  }
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
            <Route index element={<IndexRedirect />} />
            <Route path="editor" element={<AdminEditorRoute><EditorPage /></AdminEditorRoute>} />
            <Route path="collection" element={<AdminEditorRoute><CollectionPage /></AdminEditorRoute>} />
            <Route path="qr" element={<QrPage />} />
            <Route path="card" element={<CardPage />} />
            <Route path="logo" element={<LogoPage />} />
            <Route path="settings" element={<SettingsRoute />} />
            <Route path="admin" element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            } />
            <Route path="*" element={<IndexRedirect />} />
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
