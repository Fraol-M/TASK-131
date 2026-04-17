/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { OrderContextMenu } from './OrderContextMenu.js';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

function renderMenu(props: Partial<React.ComponentProps<typeof OrderContextMenu>> = {}) {
  const defaults = {
    orderId: 'ord-1',
    x: 100,
    y: 200,
    onClose: vi.fn(),
    onSplit: vi.fn(),
    onMerge: vi.fn(),
    onCreateRma: vi.fn(),
    onTagNote: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  act(() => {
    createRoot(container).render(<OrderContextMenu {...merged} />);
  });
  return merged;
}

describe('OrderContextMenu — real component behavior', () => {
  it('renders all four menu items', () => {
    renderMenu();
    const buttons = container.querySelectorAll('[role="menuitem"]');
    expect(buttons.length).toBe(4);
    const labels = Array.from(buttons).map((b) => b.textContent);
    expect(labels).toContain('Split Order');
    expect(labels).toContain('Merge Orders');
    expect(labels).toContain('Create RMA');
    expect(labels).toContain('Tag / Note');
  });

  it('clicking Split Order calls onSplit with orderId and then onClose', () => {
    const { onSplit, onClose } = renderMenu();
    const btn = Array.from(container.querySelectorAll('[role="menuitem"]'))
      .find((b) => b.textContent === 'Split Order')!;
    act(() => { (btn as HTMLElement).click(); });
    expect(onSplit).toHaveBeenCalledWith('ord-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Merge Orders calls onMerge with orderId and then onClose', () => {
    const { onMerge, onClose } = renderMenu();
    const btn = Array.from(container.querySelectorAll('[role="menuitem"]'))
      .find((b) => b.textContent === 'Merge Orders')!;
    act(() => { (btn as HTMLElement).click(); });
    expect(onMerge).toHaveBeenCalledWith('ord-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Create RMA calls onCreateRma with orderId and then onClose', () => {
    const { onCreateRma, onClose } = renderMenu();
    const btn = Array.from(container.querySelectorAll('[role="menuitem"]'))
      .find((b) => b.textContent === 'Create RMA')!;
    act(() => { (btn as HTMLElement).click(); });
    expect(onCreateRma).toHaveBeenCalledWith('ord-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Tag / Note calls onTagNote with orderId and then onClose', () => {
    const { onTagNote, onClose } = renderMenu();
    const btn = Array.from(container.querySelectorAll('[role="menuitem"]'))
      .find((b) => b.textContent === 'Tag / Note')!;
    act(() => { (btn as HTMLElement).click(); });
    expect(onTagNote).toHaveBeenCalledWith('ord-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking outside the menu calls onClose', () => {
    const { onClose } = renderMenu();
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('menu is positioned using x and y props', () => {
    renderMenu({ x: 350, y: 480 });
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.style.left).toBe('350px');
    expect(menu.style.top).toBe('480px');
  });
});
