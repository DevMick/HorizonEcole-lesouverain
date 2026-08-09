import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  /** ms avant auto-fermeture. `error` persiste par défaut (0). */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: React.ReactNode;
  action?: ToastOptions['action'];
  leaving?: boolean;
}

const ICON: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 aria-hidden />,
  info: <Info aria-hidden />,
  warning: <AlertTriangle aria-hidden />,
  error: <XCircle aria-hidden />,
};

const MAX_VISIBLE = 3;
const EXIT_MS = 200;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<(v: ToastItem[]) => void>();
const emit = () => listeners.forEach((l) => l([...items]));

function remove(id: number) {
  const t = items.find((i) => i.id === id);
  if (!t || t.leaving) return;
  t.leaving = true;
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, EXIT_MS);
}

function push(kind: ToastKind, message: React.ReactNode, opts: ToastOptions = {}) {
  ensureHost();
  const id = ++seq;
  items = [...items, { id, kind, message, action: opts.action }];
  // Empilement discret : au-delà de MAX_VISIBLE, on retire les plus anciennes
  while (items.filter((i) => !i.leaving).length > MAX_VISIBLE) {
    const oldest = items.find((i) => !i.leaving);
    if (oldest) remove(oldest.id);
    else break;
  }
  emit();
  const duration = opts.duration ?? (kind === 'error' ? 0 : 2800);
  if (duration > 0) setTimeout(() => remove(id), duration);
  return id;
}

function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => void listeners.delete(setList);
  }, []);

  return (
    <div className="ds-toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={cn('ds-toast', `ds-toast-${t.kind}`, t.leaving && 'ds-toast-leaving')}>
          <span className="ds-toast-icon">{ICON[t.kind]}</span>
          <span className="ds-toast-msg">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="ds-toast-action"
              onClick={() => {
                t.action!.onClick();
                remove(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            className="ds-toast-action text-ds-text-tertiary"
            aria-label="Fermer"
            onClick={() => remove(t.id)}
          >
            <X width={14} height={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

let hostMounted = false;
function ensureHost() {
  if (hostMounted || typeof document === 'undefined') return;
  hostMounted = true;
  const el = document.createElement('div');
  el.setAttribute('data-ds-toast-host', '');
  document.body.appendChild(el);
  createRoot(el).render(<ToastHost />);
}

/** Notifications (§5.9). Auto-fermeture ~2,8s ; variante error persistante. */
export const toast = {
  success: (msg: React.ReactNode, opts?: ToastOptions) => push('success', msg, opts),
  info: (msg: React.ReactNode, opts?: ToastOptions) => push('info', msg, opts),
  warning: (msg: React.ReactNode, opts?: ToastOptions) => push('warning', msg, opts),
  error: (msg: React.ReactNode, opts?: ToastOptions) => push('error', msg, opts),
  dismiss: remove,
};
