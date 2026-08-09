import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOverlay } from './overlay';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Fermeture au clic hors modale. Défaut true. */
  maskClosable?: boolean;
  width?: number;
}

/**
 * Modale centrée (§5.8) : actions courtes et bloquantes (confirmation, aperçu…).
 * Fermeture par croix, Échap et (optionnel) clic sur le scrim.
 */
export function Modal({ open, onClose, title, children, footer, maskClosable = true, width }: ModalProps) {
  const { mounted, shown } = useOverlay(open, onClose, 200);
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn('ds-modal-overlay', shown && 'ds-modal-overlay-open')}
      onClick={maskClosable ? onClose : undefined}
    >
      <div className="ds-scrim ds-scrim-open" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Fenêtre'}
        className="ds-modal"
        style={width ? { maxWidth: width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="ds-modal-head">
            <h2 className="ds-modal-title flex-1">{title}</h2>
            <Button variant="ghost" size="sm" iconOnly icon={<X aria-hidden />} onClick={onClose} aria-label="Fermer" />
          </div>
        )}
        <div className="ds-modal-body">{children}</div>
        {footer && <div className="ds-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
