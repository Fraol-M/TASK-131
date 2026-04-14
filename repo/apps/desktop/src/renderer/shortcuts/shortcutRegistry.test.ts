/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { registerShortcuts } from './shortcutRegistry.js';

function fireKey(key: string, modifiers: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    altKey: modifiers.altKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
}

describe('shortcutRegistry — keyboard shortcuts', () => {
  it('Ctrl+K dispatches nexus:search:open custom event', () => {
    const navigate = vi.fn();
    const cleanup = registerShortcuts({ navigate });

    const listener = vi.fn();
    document.addEventListener('nexus:search:open', listener);

    fireKey('k', { ctrlKey: true });
    expect(listener).toHaveBeenCalledTimes(1);

    document.removeEventListener('nexus:search:open', listener);
    cleanup();
  });

  it('Alt+1 navigates to /orders', () => {
    const navigate = vi.fn();
    const cleanup = registerShortcuts({ navigate });

    fireKey('1', { altKey: true });
    expect(navigate).toHaveBeenCalledWith('/orders');

    cleanup();
  });

  it('Alt+2 navigates to /rules', () => {
    const navigate = vi.fn();
    const cleanup = registerShortcuts({ navigate });

    fireKey('2', { altKey: true });
    expect(navigate).toHaveBeenCalledWith('/rules');

    cleanup();
  });

  it('Ctrl+Enter dispatches nexus:checkout:submit custom event', () => {
    const navigate = vi.fn();
    const cleanup = registerShortcuts({ navigate });

    const listener = vi.fn();
    document.addEventListener('nexus:checkout:submit', listener);

    fireKey('Enter', { ctrlKey: true });
    expect(listener).toHaveBeenCalledTimes(1);

    document.removeEventListener('nexus:checkout:submit', listener);
    cleanup();
  });

  it('cleanup removes the keydown listener', () => {
    const navigate = vi.fn();
    const cleanup = registerShortcuts({ navigate });
    cleanup();

    fireKey('1', { altKey: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('unmodified keys do not trigger navigation', () => {
    const navigate = vi.fn();
    const cleanup = registerShortcuts({ navigate });

    fireKey('1');
    fireKey('k');
    fireKey('Enter');
    expect(navigate).not.toHaveBeenCalled();

    cleanup();
  });
});
