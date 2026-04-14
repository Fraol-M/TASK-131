import React, { useEffect, useState, useCallback } from 'react';

interface Notification {
  _id: string;
  title: string;
  body: string;
  milestone: string;
  relatedEntityId?: string;
  read: boolean;
  createdAt: string;
}

const SERVICE_BASE = `https://127.0.0.1:${(window as unknown as { __SERVICE_PORT__?: string }).__SERVICE_PORT__ ?? '4433'}`;

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SERVICE_BASE}${path}`, { credentials: 'include', ...init });
}

export default function NotificationsPage(): React.ReactElement {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/notifications${unreadOnly ? '?unread=true' : ''}`);
      if (res.ok) {
        const body = await res.json() as { data: Notification[] };
        setNotifications(body.data);
      }
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => { void load(); }, [load]);

  // Listen for real-time notification pushes from main process
  useEffect(() => {
    const unsub = window.nexusorder.onNotification((title, body) => {
      setNotifications((prev) => [{
        _id: `live-${Date.now()}`,
        title,
        body,
        milestone: 'general',
        read: false,
        createdAt: new Date().toISOString(),
      }, ...prev]);
    });
    return unsub;
  }, []);

  async function markRead(id: string): Promise<void> {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Notifications</h2>
        <label style={{ fontSize: '0.9rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
      </div>

      {loading && <p style={{ color: '#888' }}>Loading…</p>}

      {!loading && notifications.length === 0 && (
        <p style={{ color: '#888' }}>No notifications.</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {notifications.map((n) => (
          <li
            key={n._id}
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '0.5rem',
              borderRadius: 4,
              backgroundColor: n.read ? '#f9f9f9' : '#e8f0fe',
              border: `1px solid ${n.read ? '#e0e0e0' : '#c5d8fd'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontWeight: n.read ? 'normal' : 600, marginBottom: '0.2rem' }}>{n.title}</div>
              <div style={{ fontSize: '0.85rem', color: '#555' }}>{n.body}</div>
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                {new Date(n.createdAt).toLocaleString()} · {n.milestone}
              </div>
            </div>
            {!n.read && (
              <button
                onClick={() => void markRead(n._id)}
                style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
              >
                Mark read
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
