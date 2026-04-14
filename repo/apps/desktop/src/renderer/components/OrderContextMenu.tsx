import React, { useEffect, useRef } from 'react';

interface Props {
  orderId: string;
  x: number;
  y: number;
  onClose: () => void;
  onSplit: (orderId: string) => void;
  onMerge: (orderId: string) => void;
  onCreateRma: (orderId: string) => void;
  onTagNote: (orderId: string) => void;
}

export function OrderContextMenu({ orderId, x, y, onClose, onSplit, onMerge, onCreateRma, onTagNote }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { label: 'Split Order', action: () => { onSplit(orderId); onClose(); } },
    { label: 'Merge Orders', action: () => { onMerge(orderId); onClose(); } },
    { label: 'Create RMA', action: () => { onCreateRma(orderId); onClose(); } },
    { label: 'Tag / Note', action: () => { onTagNote(orderId); onClose(); } },
  ];

  return (
    <div
      ref={menuRef}
      style={{ ...styles.menu, left: x, top: y }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          style={styles.item}
          role="menuitem"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  menu: {
    position: 'fixed' as const,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '0.25rem 0',
    minWidth: 160,
    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
    zIndex: 1000,
  },
  item: {
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    padding: '0.5rem 1rem',
    textAlign: 'left' as const,
    fontSize: 13,
    cursor: 'pointer',
  },
} as const;
