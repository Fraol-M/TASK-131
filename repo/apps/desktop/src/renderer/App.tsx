import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.js';
import { useAuthStore } from './modules/auth/useAuth.js';

export default function App() {
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return <RouterProvider router={router} />;
}
