import type { NavigateFunction } from 'react-router-dom';

interface ShortcutContext {
  navigate: NavigateFunction;
}

/**
 * Registers global keyboard shortcuts.
 * Returns a cleanup function to be called on component unmount.
 *
 * Ctrl+K  → GlobalSearch modal
 * Alt+1   → Orders page
 * Alt+2   → Rules page
 * Ctrl+Enter → Checkout submit (dispatched as custom event; CartPage listens)
 */
export function registerShortcuts({ navigate }: ShortcutContext): () => void {
  const handler = (e: KeyboardEvent) => {
    // Ctrl+K — open global search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('nexus:search:open'));
      return;
    }

    // Alt+1 — navigate to Orders
    if (e.altKey && e.key === '1') {
      e.preventDefault();
      navigate('/orders');
      return;
    }

    // Alt+2 — navigate to Rules
    if (e.altKey && e.key === '2') {
      e.preventDefault();
      navigate('/rules');
      return;
    }

    // Ctrl+Enter — trigger checkout submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('nexus:checkout:submit'));
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
