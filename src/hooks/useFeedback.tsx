import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, X, HelpCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  message: string;
  resolve: (value: boolean) => void;
}

interface FeedbackContextType {
  toast: (message: string, type: ToastType) => void;
  confirm: (message: string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);

  // Références STABLES (mémoïsées) : des effets consommateurs s'abonnent à des
  // listeners Firestore avec `toast` en dépendance — une nouvelle référence à
  // chaque render provoquerait un ré-abonnement permanent.
  const toast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        message,
        resolve,
      });
    });
  }, []);

  const handleConfirmClose = (value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  };

  // Keyboard support for confirm modal (Escape to cancel, Enter to confirm)
  useEffect(() => {
    if (!confirmState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleConfirmClose(false);
      } else if (e.key === 'Enter') {
        handleConfirmClose(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* TOASTS PORTAL LAYER */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            let bgClass = '';
            let borderClass = '';
            let textClass = '';
            let Icon = CheckCircle2;

            if (t.type === 'success') {
              bgClass = 'bg-emerald-50 dark:bg-emerald-950/90';
              borderClass = 'border-emerald-200 dark:border-emerald-900/60';
              textClass = 'text-emerald-800 dark:text-emerald-300';
              Icon = CheckCircle2;
            } else if (t.type === 'warning') {
              bgClass = 'bg-amber-50 dark:bg-amber-950/90';
              borderClass = 'border-amber-200 dark:border-amber-900/60';
              textClass = 'text-amber-800 dark:text-amber-300';
              Icon = AlertTriangle;
            } else {
              bgClass = 'bg-rose-50 dark:bg-rose-950/90';
              borderClass = 'border-rose-200 dark:border-rose-900/60';
              textClass = 'text-rose-800 dark:text-rose-300';
              Icon = AlertCircle;
            }

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md ${bgClass} ${borderClass} ${textClass} min-w-[280px]`}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs font-semibold leading-relaxed">
                  {t.message}
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                  className="p-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* CONFIRMATION DIALOG LAYER */}
      <AnimatePresence>
        {confirmState && (
          <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            {/* Backdrop blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirmClose(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-md overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-10"
            >
              {/* Premium gradient header stripe */}
              <div className="h-1.5 w-full bg-gradient-to-r from-deep to-azur" />

              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-azur-light dark:bg-azur/10 text-azur dark:text-azur-pastel">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-deep dark:text-slate-50 font-display tracking-tight">
                      Confirmation de l'action
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                      {confirmState.message}
                    </p>
                  </div>
                </div>

                {/* Styled action buttons */}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleConfirmClose(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmClose(true)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-azur hover:bg-azur-hover text-white shadow-md shadow-azur/15 transition-all cursor-pointer"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}
