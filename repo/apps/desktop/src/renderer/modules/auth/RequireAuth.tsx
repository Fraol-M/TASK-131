import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './useAuth.js';
import NavLayout from '../../components/NavLayout.js';

export function RequireAuth() {
  const { user, loading } = useAuthStore();

  if (loading) return <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <NavLayout>
      <Outlet />
    </NavLayout>
  );
}
