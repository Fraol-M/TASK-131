import React, { useEffect, useCallback, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../modules/auth/useAuth.js';
import { getVisibleNav } from '../modules/auth/menuPermissionMap.js';
import { registerShortcuts } from '../shortcuts/shortcutRegistry.js';
import { GlobalSearchModal } from '../modules/search/GlobalSearchModal.js';

interface Props {
  children: React.ReactNode;
}

export default function NavLayout({ children }: Props) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const navItems = user ? getVisibleNav(user.role) : [];
  const [searchOpen, setSearchOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  useEffect(() => {
    return registerShortcuts({ navigate });
  }, [navigate]);

  // Global listener for the nexus:search:open custom event fired by Ctrl+K shortcut.
  // Mounted here (layout root) so the search modal is accessible from every page,
  // not just CatalogPage.
  useEffect(() => {
    const handler = () => setSearchOpen(true);
    document.addEventListener('nexus:search:open', handler);
    return () => document.removeEventListener('nexus:search:open', handler);
  }, []);

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>NexusOrder</div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                ...styles.navItem,
                background: isActive ? '#1e3a5f' : 'transparent',
                color: isActive ? '#60a5fa' : '#cbd5e1',
              })}
            >
              <span>{item.label}</span>
              {item.shortcut && <span style={styles.shortcut}>{item.shortcut}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={styles.userArea}>
          {user && (
            <>
              <div style={styles.userName}>{user.displayName}</div>
              <div style={styles.userRole}>{user.role}</div>
              <button onClick={handleLogout} style={styles.logoutBtn}>Sign out</button>
            </>
          )}
        </div>
      </aside>

      <main style={styles.main}>{children}</main>

      {searchOpen && <GlobalSearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

const styles = {
  root: { display: 'flex', height: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: 220, background: '#1e293b', display: 'flex', flexDirection: 'column' as const, padding: '1rem 0', flexShrink: 0 },
  brand: { color: '#60a5fa', fontWeight: 700, fontSize: 16, padding: '0 1rem 1.5rem' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 2 },
  navItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.6rem 1rem', textDecoration: 'none', borderRadius: 6,
    margin: '0 0.5rem', fontSize: 14, fontWeight: 500, transition: 'background 0.15s',
  },
  shortcut: { fontSize: 10, color: '#475569', fontFamily: 'monospace' },
  userArea: { padding: '1rem', borderTop: '1px solid #334155' },
  userName: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' },
  userRole: { fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'capitalize' as const },
  logoutBtn: {
    marginTop: 8, width: '100%', background: 'transparent', border: '1px solid #334155',
    color: '#94a3b8', borderRadius: 4, padding: '0.4rem', fontSize: 12, cursor: 'pointer',
  },
} as const;
