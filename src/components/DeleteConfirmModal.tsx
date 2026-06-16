import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  itemName: string;
  itemType: 'file' | 'folder';
  itemSize?: string | null;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType,
  itemSize
}: DeleteConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset loading state when modal open state changes
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle keyboard events (Escape to close, Enter to confirm)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error('Failed to confirm deletion:', err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with elegant blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-md overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-10"
          >
            {/* Header border stripe representing priority warning */}
            <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-amber-500" />

            <div className="p-6">
              {/* Alert Icon & Header */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50 font-sans tracking-tight">
                    Supprimer {itemType === 'file' ? 'ce fichier' : 'ce dossier'} ?
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Cette action est définitive. Les données supprimées ne pourront pas être récupérées.
                  </p>
                </div>
              </div>

              {/* Item Details Box */}
              <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 p-4">
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nom de la ressource</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate mt-0.5">
                      {itemName}
                    </span>
                  </div>
                  {itemSize && (
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Taille</span>
                      <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                        {itemSize}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Suppression...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Supprimer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
