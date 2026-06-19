import React, { useEffect, useMemo, useState } from 'react';
import { Search, ScrollText, Download } from 'lucide-react';
import { AuditLog, AuditAction, subscribeAuditLogs } from '../lib/auditLog';

/**
 * Visualiseur du journal d'activité.
 *  - `antenneId` fourni → logs de cette antenne uniquement (vue gestionnaire).
 *  - `antenneId` absent → tous les logs (vue super admin).
 */

const ACTION_META: Record<string, { label: string; icon: string; cls: string }> = {
  login: { label: 'Connexion', icon: '🔓', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  logout: { label: 'Déconnexion', icon: '🔒', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  file_upload: { label: 'Dépôt de fichier', icon: '⬆️', cls: 'bg-azur/10 text-azur border-azur/20' },
  file_delete: { label: 'Suppression de fichier', icon: '🗑️', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  file_status_change: { label: 'Statut de fichier', icon: '🏷️', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  file_share_toggle: { label: 'Partage de fichier', icon: '🔁', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  file_rename: { label: 'Renommage de fichier', icon: '✏️', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  file_move: { label: 'Déplacement de fichier', icon: '📦', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  file_download: { label: 'Téléchargement', icon: '⬇️', cls: 'bg-azur/10 text-azur border-azur/20' },
  folder_create: { label: 'Création de dossier', icon: '📁', cls: 'bg-azur/10 text-azur border-azur/20' },
  folder_delete: { label: 'Suppression de dossier', icon: '🗂️', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  org_create: { label: 'Nouveau compte', icon: '✨', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  org_delete: { label: 'Suppression de compte', icon: '🧹', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  org_role_change: { label: 'Changement de rôle', icon: '🛡️', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  org_status_change: { label: 'Statut de compte', icon: '⚙️', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  org_reminder: { label: 'Relance e-mail', icon: '✉️', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  org_assign_antenne: { label: "Affectation d'antenne", icon: '📍', cls: 'bg-azur/10 text-azur border-azur/20' },
  org_profile_update: { label: 'Profil mis à jour', icon: '✏️', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  antenne_create: { label: "Création d'antenne", icon: '🛰️', cls: 'bg-azur/10 text-azur border-azur/20' },
  antenne_delete: { label: "Suppression d'antenne", icon: '💥', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  antenne_update: { label: "Modification d'antenne", icon: '🛠️', cls: 'bg-azur/10 text-azur border-azur/20' },
  antenne_group_change: { label: "Groupe d'antennes", icon: '🗺️', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  antenne_settings_change: { label: "Réglages d'antenne", icon: '🔔', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  delegation_create: { label: 'Création de délégation', icon: '🏛️', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin national',
  admin_delegation: 'Coordinateur',
  admin_antenne: "Gestionnaire d'antenne",
  organization: 'Partenaire',
};

function actionMeta(a: string) {
  return ACTION_META[a] || { label: a, icon: '•', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

const CATEGORIES: { id: string; label: string; actions: string[] }[] = [
  { id: 'all', label: 'Toutes les actions', actions: [] },
  { id: 'auth', label: 'Connexions', actions: ['login', 'logout'] },
  { id: 'files', label: 'Fichiers', actions: ['file_upload', 'file_delete', 'file_status_change', 'file_share_toggle', 'file_rename', 'file_move', 'file_download'] },
  { id: 'folders', label: 'Dossiers', actions: ['folder_create', 'folder_delete'] },
  { id: 'accounts', label: 'Comptes & rôles', actions: ['org_create', 'org_delete', 'org_role_change', 'org_status_change', 'org_reminder', 'org_assign_antenne', 'org_profile_update'] },
  { id: 'structure', label: 'Antennes & délégations', actions: ['antenne_create', 'antenne_delete', 'antenne_update', 'antenne_group_change', 'antenne_settings_change', 'delegation_create'] },
];

export default function AuditLogPanel({
  antenneId,
  title = "Journal d'activité",
  subtitle,
}: {
  antenneId?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    const unsub = subscribeAuditLogs({ antenneId: antenneId || null }, setLogs);
    return unsub;
  }, [antenneId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cat = CATEGORIES.find((c) => c.id === category);
    return logs.filter((l) => {
      if (cat && cat.actions.length > 0 && !cat.actions.includes(l.action as AuditAction)) return false;
      if (!q) return true;
      return (
        (l.actorName || '').toLowerCase().includes(q) ||
        (l.targetName || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q) ||
        actionMeta(l.action).label.toLowerCase().includes(q)
      );
    });
  }, [logs, search, category]);

  const exportCsv = () => {
    // Neutralise les retours-ligne (et le risque d'injection de formule Excel)
    // dans chaque cellule, puis échappe les guillemets.
    const cell = (v: unknown) => {
      let s = String(v ?? '').replace(/[\r\n]+/g, ' ');
      if (/^[=+\-@]/.test(s)) s = "'" + s; // anti CSV-injection
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ['Date', 'Acteur', 'Rôle', 'Action', 'Cible', 'Détails', 'Antenne'];
    const rows = filtered.map((l) => [
      formatDate(l.timestamp),
      l.actorName || '',
      ROLE_LABEL[l.actorRole] || l.actorRole || '',
      actionMeta(l.action).label,
      l.targetName || '',
      l.details || '',
      l.antenne_id || '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map(cell).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `journal_activite_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-deep dark:text-white tracking-tight">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {subtitle || 'Historique horodaté de toutes les actions traçables.'}
            </p>
          </div>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="btn-secondary text-sm self-start sm:self-auto disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Exporter (CSV)</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un acteur, un fichier, une action…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-azur/40"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                category === c.id
                  ? 'bg-azur text-white border-azur'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-azur/40'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {filtered.length} entrée{filtered.length > 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 font-semibold">
            Aucune action enregistrée pour le moment.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((l) => {
              const m = actionMeta(l.action);
              return (
                <div key={l.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <span className={`shrink-0 mt-0.5 text-[10px] font-black uppercase px-2 py-1 rounded-lg border inline-flex items-center gap-1 ${m.cls}`}>
                    <span>{m.icon}</span>
                    <span className="hidden sm:inline">{m.label}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-deep dark:text-slate-100 font-semibold leading-snug">
                      <span className="font-black">{l.actorName}</span>
                      <span className="text-[10px] font-bold uppercase ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {ROLE_LABEL[l.actorRole] || l.actorRole}
                      </span>
                      {l.targetName && (
                        <span className="text-slate-500 dark:text-slate-400 font-medium"> — {l.targetName}</span>
                      )}
                    </p>
                    {l.details && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{l.details}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400 font-mono tabular-nums whitespace-nowrap mt-0.5">
                    {formatDate(l.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
