/**
 * Modal sheet: slides up from the bottom on phones, centered card on wide screens.
 * Escape or the backdrop closes it.
 */
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import './Sheet.css';

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus moves into the sheet on open and back to whatever had it on close. */
function useFocusReturn(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? ref.current)?.focus();
    return () => previous?.focus?.();
  }, [ref]);
}

/** Tab and Shift+Tab cycle within the sheet. */
function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'Tab') return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const ordered = e.shiftKey ? [...items].reverse() : items;
  if (document.activeElement !== ordered.at(-1)) return;
  e.preventDefault();
  ordered[0]?.focus();
}

export function Sheet({ label, onClose, children, wide = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusReturn(ref);
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
      <div ref={ref} tabIndex={-1} onKeyDown={trapTab} className={`sheet${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="sheet-header">
      <h2 className="sheet-title">{title}</h2>
      <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
