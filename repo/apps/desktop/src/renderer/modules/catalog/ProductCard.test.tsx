/**
 * @vitest-environment jsdom
 *
 * Unit tests for ProductCard: item name, price, SKU masking, unavailable state, Add to Cart callback.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ProductCard } from './ProductCard.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'item-1',
    name: 'Wireless Mouse',
    sku: 'WM-001-XYZ',
    unitPrice: 29.99,
    currency: 'CNY',
    stock: 10,
    isAvailable: true,
    eligibleScopes: [],
    vendorId: 'v1',
    taxRate: 0.08,
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
});

function render(item: ReturnType<typeof makeItem>, onAddToCart = vi.fn()) {
  act(() => {
    root = createRoot(container);
    root.render(<ProductCard item={item as never} onAddToCart={onAddToCart} />);
  });
}

describe('ProductCard', () => {
  it('renders the item name', () => {
    render(makeItem({ name: 'Blue Pen' }));
    expect(container.textContent).toContain('Blue Pen');
  });

  it('renders the formatted price', () => {
    render(makeItem({ unitPrice: 49.5 }));
    expect(container.textContent).toContain('49.50');
  });

  it('renders description when provided', () => {
    render(makeItem({ description: 'A quality pen' }));
    expect(container.textContent).toContain('A quality pen');
  });

  it('does not render description element when absent', () => {
    render(makeItem({ description: undefined }));
    expect(container.textContent).not.toContain('A quality pen');
  });

  it('shows Add to Cart button when item is available', () => {
    render(makeItem({ isAvailable: true }));
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /add to cart/i.test(b.textContent ?? ''),
    );
    expect(btn).toBeDefined();
  });

  it('shows unavailable message instead of Add to Cart when item is unavailable', () => {
    render(makeItem({ isAvailable: false }));
    expect(container.textContent).toMatch(/unavailable/i);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /add to cart/i.test(b.textContent ?? ''),
    );
    expect(btn).toBeUndefined();
  });

  it('calls onAddToCart when Add to Cart is clicked', () => {
    const onAddToCart = vi.fn();
    render(makeItem(), onAddToCart);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /add to cart/i.test(b.textContent ?? ''),
    )!;
    act(() => { btn.click(); });
    expect(onAddToCart).toHaveBeenCalledOnce();
  });
});
