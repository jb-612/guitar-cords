/**
 * Modal sheet: slides up from the bottom on phones, centered card on wide screens.
 * Escape or the backdrop closes it.
 */
import { useEffect, type ReactNode } from 'react';
import './Sheet.css';

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Sheet({ label, onClose, children, wide = false }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`sheet${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header className="sheet-header">
      <h2 className="sheet-title">{title}</h2>
      <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}
