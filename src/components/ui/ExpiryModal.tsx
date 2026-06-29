import { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { localDb } from '../../lib/localDb';
import {
  tsToExpiryInput,
  expiryInputToTs,
  minExpiryDateInput,
  formatExpiryDate,
} from '../../lib/expiry';

/**
 * Logique + interface partagées de la « suppression automatique » (échéance
 * `expiresAt`) des fichiers et dossiers. Mutualise le code auparavant dupliqué
 * à l'identique entre le panneau super admin et le tableau de bord gestionnaire
 * d'antenne : un seul endroit à corriger/faire évoluer.
 */

export interface ExpiryTarget {
  kind: 'file' | 'folder';
  id: string;
  name: string;
  current?: number | null;
}

type ToastFn = (message: string, type?: 'success' | 'error' | 'warning') => void;

interface ExpiryItem {
  id: string;
  name: string;
  expiresAt?: number | null;
}

/**
 * État et actions de programmation d'échéance.
 *
 * @param toast            Fonction de notification de l'hôte.
 * @param onSandboxSaved   Rappel optionnel après une sauvegarde en mode sandbox
 *                         (le mode Firestore se rafraîchit via onSnapshot ; le
 *                         mode local doit recharger explicitement chez certains
 *                         hôtes).
 */
export function useExpiry(opts: { toast: ToastFn; onSandboxSaved?: () => void }) {
  const [expiryTarget, setExpiryTarget] = useState<ExpiryTarget | null>(null);
  const [expiryValue, setExpiryValue] = useState('');
  const [savingExpiry, setSavingExpiry] = useState(false);

  const openExpiry = (kind: 'file' | 'folder', item: ExpiryItem) => {
    setExpiryTarget({ kind, id: item.id, name: item.name, current: item.expiresAt ?? null });
    setExpiryValue(tsToExpiryInput(item.expiresAt));
  };

  const closeExpiry = () => setExpiryTarget(null);

  const saveExpiry = async (ts: number | null) => {
    if (!expiryTarget) return;
    setSavingExpiry(true);
    const { kind, id } = expiryTarget;
    const coll = kind === 'file' ? 'files' : 'folders';
    try {
      if (localDb.isSandboxActive()) {
        if (kind === 'file') {
          const t = localDb.getFiles().find((f) => f.id === id);
          if (t) { t.expiresAt = ts; localDb.saveFile(t); }
        } else {
          const t = localDb.getFolders().find((f) => f.id === id);
          if (t) { t.expiresAt = ts; localDb.saveFolder(t); }
        }
        opts.onSandboxSaved?.();
      } else {
        await updateDoc(doc(db, coll, id), { expiresAt: ts });
      }
      opts.toast(
        ts
          ? `Suppression automatique programmée le ${formatExpiryDate(ts)}.`
          : 'Suppression automatique retirée.',
        'success',
      );
    } catch (err: any) {
      console.error('Set expiry failed:', err);
      opts.toast('Échec de la programmation : ' + (err?.message || 'erreur'), 'error');
    }
    setSavingExpiry(false);
    setExpiryTarget(null);
  };

  return { expiryTarget, expiryValue, setExpiryValue, savingExpiry, openExpiry, saveExpiry, closeExpiry };
}

/** Raccourcis pratiques (en jours) proposés dans la modale. */
const PRESETS = [
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
  { label: '6 mois', days: 182 },
  { label: '1 an', days: 365 },
];

/** Fenêtre modale de programmation/retrait de la suppression automatique. */
export function ExpiryModal({
  target,
  value,
  setValue,
  saving,
  onSave,
  onClose,
}: {
  target: ExpiryTarget | null;
  value: string;
  setValue: (v: string) => void;
  saving: boolean;
  onSave: (ts: number | null) => void;
  onClose: () => void;
}) {
  if (!target) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-azur/10 text-azur dark:text-azur-pastel flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel">Suppression automatique</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {target.kind === 'folder' ? 'Dossier' : 'Document'} : {target.name}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {target.kind === 'folder'
            ? 'À la date choisie, ce dossier et tous les fichiers qu’il contient seront supprimés définitivement.'
            : 'À la date choisie, ce document sera supprimé définitivement.'}{' '}
          L’organisme est informé de la date directement sur la pièce concernée.
        </p>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Date de suppression</label>
          <input
            type="date"
            value={value}
            min={minExpiryDateInput()}
            onChange={(e) => setValue(e.target.value)}
            className="input-asf w-full mt-1"
          />
        </div>

        {/* Raccourcis pratiques */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setValue(tsToExpiryInput(Date.now() + p.days * 24 * 60 * 60 * 1000))}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-azur/50 hover:text-azur transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          {typeof target.current === 'number' ? (
            <button
              onClick={() => onSave(null)}
              disabled={saving}
              className="text-sm font-bold px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <X className="w-4 h-4" /> Retirer
            </button>
          ) : <span />}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} disabled={saving} className="btn-secondary text-sm">Annuler</button>
            <button
              onClick={() => onSave(expiryInputToTs(value))}
              disabled={saving || !value}
              className="btn-asf text-sm disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Programmer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
