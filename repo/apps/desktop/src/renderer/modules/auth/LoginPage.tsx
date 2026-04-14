import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from './useAuth.js';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, user } = useAuthStore();
  const { register, handleSubmit, formState } = useForm<LoginForm>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/orders', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (data: LoginForm) => {
    setSubmitError(null);
    const ok = await login(data.username, data.password);
    if (!ok) setSubmitError(error ?? 'Login failed');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>NexusOrder Desk</h1>
        <p style={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
          <label style={styles.label}>
            Username
            <input
              {...register('username', { required: true })}
              style={styles.input}
              autoFocus
              autoComplete="username"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              {...register('password', { required: true })}
              type="password"
              style={styles.input}
              autoComplete="current-password"
            />
          </label>

          {(submitError || formState.errors.username || formState.errors.password) && (
            <p style={styles.error}>
              {submitError ?? 'Username and password are required'}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0f172a',
  },
  card: {
    background: '#1e293b', borderRadius: 12, padding: '2.5rem',
    width: 380, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
  },
  title: { color: '#f1f5f9', fontSize: 24, margin: 0, fontWeight: 700 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 6 },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 16, marginTop: 24 },
  label: { color: '#cbd5e1', fontSize: 13, display: 'flex', flexDirection: 'column' as const, gap: 6 },
  input: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
    color: '#f1f5f9', padding: '0.6rem 0.75rem', fontSize: 14,
    outline: 'none',
  },
  error: { color: '#f87171', fontSize: 13, margin: 0 },
  button: {
    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
    padding: '0.75rem', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    marginTop: 8,
  },
} as const;
