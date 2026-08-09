import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOverlay } from './overlay';
import { Button } from './Button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Contenu à droite de l'en-tête (avatar, badge…). */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}

/**
 * Tiroir latéral (§5.8) : glisse depuis la droite (plein écran mobile).
 * Fermeture par croix, clic sur le scrim ou Échap. Utilisé pour les fiches détail.
 */
export function Drawer({ open, onClose, title, headerExtra, children, width }: DrawerProps) {
  const { mounted, shown } = useOverlay(open, onClose, 320);
  if (!mounted) return null;

  return createPortal(
    <>
      <div className={cn('ds-scrim', shown && 'ds-scrim-open')} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Panneau de détail'}
        className={cn('ds-drawer', shown && 'ds-drawer-open')}
        style={width ? { width } : undefined}
      >
        <div className="ds-drawer-head">
          {headerExtra}
          {title && <h2 className="ds-drawer-title flex-1">{title}</h2>}
          <Button variant="ghost" size="sm" iconOnly icon={<X aria-hidden />} onClick={onClose} aria-label="Fermer" />
        </div>
        <div className="ds-drawer-body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}
