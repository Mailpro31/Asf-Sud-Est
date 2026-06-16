import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderPlus, Loader2, X } from 'lucide-react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void> | void;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
  onConfirm
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setError(null);
      setIsSubmitting(false);
      // Auto-focus the input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Escape key support
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = folderName.trim();
    if (!finalName) {
      setError('Le nom du dossier ne peut pas être vide.');
      return;
    }
    if (finalName.length > 50) {
      setError('Le nom du dossier est trop long (50 caractères maximum).');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(finalName);
      onClose();
    } catch (err: any) {
      console.error('Error creating folder in modal:', err);
      setError('Une erreur est survenue lors de la création du dossier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Elegant Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-md overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-10"
          >
            {/* Header border stripe representing action priority */}
            <div className="h-1.5 w-full bg-indigo-600" />

            {/* Close trigger */}
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              {/* Header Icon + Title */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FolderPlus className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50 font-sans tracking-tight">
                    Créer un nouveau dossier
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Saisissez un nom explicite pour structurer votre espace de documents.
                  </p>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="folderName" className="block text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Nom du dossier
                  </label>
                  <input
                    ref={inputRef}
                    id="folderName"
                    type="text"
                    value={folderName}
                    onChange={(e) => {
                      setFolderName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. Agréments 2026, Rapports d'activités..."
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium disabled:opacity-50"
                    maxLength={50}
                    autoComplete="off"
                  />
                  
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-rose-500 font-semibold mt-2"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Création...</span>
                      </>
                    ) : (
                      <>
                        <FolderPlus className="h-4 w-4" />
                        <span>Créer</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
