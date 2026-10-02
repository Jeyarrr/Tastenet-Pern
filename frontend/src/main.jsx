import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, homeFor, useAuth } from './auth.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import { CustomerPage } from './pages/CustomerPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { RiderPage } from './pages/RiderPage.jsx';
import { SuperAdminPage } from './pages/SuperAdminPage.jsx';
import './styles.css';
import './interactions.css';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader">Preparing your TasteNet workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!(Array.isArray(role) ? role.includes(user.role) : user.role === role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function Start() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader">Preparing your TasteNet workspace…</div>;
  return user ? <Navigate to={homeFor(user.role)} replace /> : <CustomerPage />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/customer" element={<Protected role="customer"><CustomerPage /></Protected>} />
          <Route path="/admin" element={<Protected role={['admin', 'superadmin']}><AdminPage /></Protected>} />
          <Route path="/rider" element={<Protected role="rider"><RiderPage /></Protected>} />
          <Route path="/superadmin" element={<Protected role="superadmin"><SuperAdminPage /></Protected>} />
          <Route path="*" element={<Start />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
