/**
 * Coque de modale du design system ASF.
 *
 * Fournit une structure cohérente (overlay flouté, panneau animé, header
 * avec titre + bouton fermer, corps défilant et footer optionnel) afin que
 * toutes les modales de l'application partagent la même apparence et le même
 * comportement (fermeture via Échap / clic sur l'overlay).
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const SIZE_CLASS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Icône affichée à gauche du titre. */
  icon?: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** Contenu du pied de modale (boutons d'action). */
  footer?: React.ReactNode;
  /** Désactive la fermeture par Échap / clic overlay (ex : action en cours). */
  dismissable?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  footer,
  dismissable = true,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, dismissable, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => dismissable && onClose()}
        >
          <motion.div
            className={cn('modal-panel flex flex-col max-h-[90vh]', SIZE_CLASS[size], className)}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || icon) && (
              <div className="flex items-start gap-3 px-6 py-5 border-b border-slate-200/70 dark:border-slate-700">
                {icon && (
                  <span className="shrink-0 w-10 h-10 rounded-xl bg-azur-light text-azur flex items-center justify-center">
                    {icon}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="font-display text-lg font-bold text-deep dark:text-azur-pastel leading-tight">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 w-8 h-8 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="px-6 py-5 overflow-y-auto">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/70 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default Modal;
