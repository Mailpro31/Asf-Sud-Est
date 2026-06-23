import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Check,
  ExternalLink,
  Search,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DossierFile, Folder, Organization, SubmissionStatus } from '../types';
import { StatusBadge, StatusActions } from './ui';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import AntenneDashboardModal from './AntenneDashboardModal';

interface AilesDuSourireDashboardProps {
  files: DossierFile[];
  folders: Folder[];
  orgProfiles: Organization[];
  activeAntenneId: string | null;
  setActiveAntenneId: (id: string | null) => void;
  antennes: Record<string, { id: string; name: string; x?: number; y?: number }[]>;
  delegationFilterId: string;
  onUpdateFileStatus: (fileId: string, status: SubmissionStatus) => void;
  themeAttr: {
    colorClass: string;
    gradientClass: string;
    badgeClass: string;
    bgDecorative: string;
    accentText: string;
    hoverAccent: string;
    ringColor: string;
    bannerBorder: string;
  };
}

export default function AilesDuSourireDashboard({
  files,
  folders,
  orgProfiles,
  activeAntenneId,
  setActiveAntenneId,
  antennes,
  delegationFilterId,
  onUpdateFileStatus,
  themeAttr,
}: AilesDuSourireDashboardProps) {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAntenneDashboardId, setSelectedAntenneDashboardId] = useState<string | null>(null);

  // --- Notifications « nouveau » (par admin, localStorage — aucune écriture
  //     Firestore). Un document non encore consulté est entouré de rouge ;
  //     cliquer dessus (valider, télécharger, ouvrir l'antenne ou la pastille
  //     « Nouveau ») efface l'indicateur. Même mécanisme que le dashboard antenne.
  const seenKey = `asf_ailes_seen_${user?.uid || 'anon'}`;
  const [seen, setSeen] = useState<{ baseline: number; items: Record<string, number> }>(() => {
    try {
      const raw = localStorage.getItem(seenKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.baseline === 'number' && p.items) return p;
      }
    } catch { /* ignore */ }
    const init = { baseline: Date.now(), items: {} as Record<string, number> };
    try { localStorage.setItem(seenKey, JSON.stringify(init)); } catch { /* ignore */ }
    return init;
  });
  const isUnseen = useCallback(
    (id: string, ts: number) => !!id && ts > 0 && ts > (seen.items[id] ?? seen.baseline),
    [seen],
  );
  const markSeen = useCallback((id: string) => {
    if (!id) return;
    setSeen((prev) => {
      const next = { ...prev, items: { ...prev.items, [id]: Date.now() } };
      try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [seenKey]);
  const fileStamp = (f: DossierFile) => Math.max(f.uploadDate || 0, (f as any).updatedAt || 0);

  // Find antenne helper
  const getAntenneInfo = (file: DossierFile, org?: Organization) => {
    const antId = file.antenne_id || org?.antenne_id;
    if (!antId) return null;
    const group = antennes[delegationFilterId] || [];
    return group.find(a => a.id === antId) || { id: antId, name: antId.toUpperCase() };
  };

  // Documents à traiter (tout sauf « Validé »).
  const attentionFiles = files.filter(f => (f.submissionStatus || 'Pending') !== 'Validated');

  // Recherche
  const filteredFiles = attentionFiles.filter(f => {
    const org = orgProfiles.find(p => p.id === f.orgId);
    const orgName = org?.name || 'Organisme Inconnu';
    const antenneName = getAntenneInfo(f, org)?.name || 'Sans antenne';
    const q = searchTerm.toLowerCase();
    return f.name.toLowerCase().includes(q) || orgName.toLowerCase().includes(q) || antenneName.toLowerCase().includes(q);
  });

  // Taux de conformité global.
  const totalFilesCount = files.length;
  const validatedFilesCount = files.filter(f => f.submissionStatus === 'Validated').length;
  const validationRate = totalFilesCount > 0 ? Math.round((validatedFilesCount / totalFilesCount) * 100) : 0;

  // Nombre de documents non encore consultés (badge rouge global).
  const newCount = attentionFiles.filter(f => f.uploadedBy !== 'admin' && isUnseen(f.id, fileStamp(f))).length;

  // Toast à l'arrivée d'un nouveau document (hors montage initial).
  const prevIdsRef = useRef<Set<string> | null>(null);
  const mountTimeRef = useRef(Date.now());
  useEffect(() => {
    const attention = files.filter(f => (f.submissionStatus || 'Pending') !== 'Validated');
    const ids = new Set(attention.map(f => f.id));
    const prev = prevIdsRef.current;
    if (prev) {
      const arrived = attention.filter(f => !prev.has(f.id) && f.uploadedBy !== 'admin' && fileStamp(f) >= mountTimeRef.current);
      if (arrived.length === 1) toast(`Nouveau document à traiter : ${arrived[0].name}`, 'warning');
      else if (arrived.length > 1) toast(`${arrived.length} nouveaux documents à traiter`, 'warning');
    }
    prevIdsRef.current = ids;
  }, [files, toast]);

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800/80 p-4 sm:p-6 shadow-sm overflow-hidden text-left relative">

      <div className={`absolute top-0 left-0 right-0 h-[5px] ${themeAttr?.gradientClass || 'bg-azur'}`} />

      {/* En-tête épuré */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5 pt-1">
        <div className="flex items-center gap-2">
          <FolderOpen className={`w-5 h-5 ${themeAttr?.accentText || 'text-azur'}`} />
          <h3 className="text-base font-display font-black tracking-tight text-deep dark:text-slate-100 uppercase">
            Documents à traiter
          </h3>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {newCount > 0 && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs px-3 py-1.5 rounded-2xl font-black flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
              <span>{newCount} nouveau{newCount > 1 ? 'x' : ''}</span>
            </div>
          )}
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs px-3 py-1.5 rounded-2xl font-black flex items-center gap-2">
            <span>À traiter : {attentionFiles.length}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Conformité : {validationRate}%</span>
          </div>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un document, un organisme ou une antenne…"
          className="input-asf pl-10 text-xs font-semibold rounded-2xl dark:bg-slate-950/40 dark:border-slate-800 dark:text-slate-100"
        />
      </div>

      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Check className="w-9 h-9 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-full mb-3 shadow-xs" />
          <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
            {searchTerm ? "Aucun document ne correspond à ce filtre." : "Tout est à jour."}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[340px]">
            {searchTerm
              ? "Modifiez votre recherche pour afficher d'autres résultats."
              : "Tous les justificatifs ont été passés en revue."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-3xs">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3">Document</th>
                <th className="px-4 py-3 w-[15%]">Statut</th>
                <th className="px-5 py-3 text-right w-[18%]">Valider</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/30">
              <AnimatePresence initial={false}>
                {filteredFiles.map((file) => {
                  const org = orgProfiles.find(p => p.id === file.orgId);
                  const antenneInfo = getAntenneInfo(file, org);
                  const fileNew = file.uploadedBy !== 'admin' && isUnseen(file.id, fileStamp(file));
                  const dateStr = file.uploadDate
                    ? new Date(file.uploadDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—';

                  return (
                    <motion.tr
                      key={file.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                      className={`transition-colors group ${fileNew ? 'bg-rose-50/50 dark:bg-rose-500/5 ring-2 ring-inset ring-rose-300 dark:ring-rose-500/50' : 'hover:bg-slate-50/50 dark:hover:bg-slate-950/40'}`}
                    >
                      {/* Document + métadonnées (organisme · antenne · date) */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-3xs shrink-0">
                            <FileText className="w-4 h-4 text-slate-400 group-hover:text-azur transition-colors" />
                            {fileNew && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-xs font-display font-black text-deep dark:text-slate-200 line-clamp-1 leading-snug">
                                {file.name}
                              </p>
                              {fileNew && (
                                <button
                                  onClick={() => markSeen(file.id)}
                                  className="shrink-0 text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-rose-500 text-white hover:bg-rose-600 cursor-pointer"
                                  title="Marquer comme vu"
                                >
                                  Nouveau
                                </button>
                              )}
                            </div>
                            {/* Ligne méta : organisme · antenne · date */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px]">
                              <span className="font-black text-azur uppercase tracking-wide truncate max-w-[180px]">
                                🏢 {org?.name || 'Compagnie Partenaire'}
                              </span>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              {antenneInfo ? (
                                <button
                                  onClick={() => { markSeen(file.id); setSelectedAntenneDashboardId(antenneInfo.id); }}
                                  className="inline-flex items-center gap-1 font-extrabold text-azur hover:text-azur-hover dark:hover:text-azur-pastel uppercase tracking-tight hover:underline cursor-pointer"
                                  title="Ouvrir le tableau de bord de cette antenne"
                                >
                                  📍 {antenneInfo.name}
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </button>
                              ) : (
                                <span className="font-extrabold text-slate-400 uppercase tracking-tight">📍 sans antenne</span>
                              )}
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="text-slate-400 dark:text-slate-500 font-semibold font-mono">{dateStr}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={file.submissionStatus || 'Pending'} />
                      </td>

                      {/* Validation */}
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end items-center gap-1.5">
                          {file.fallbackDataUrl && (
                            <a
                              href={file.fallbackDataUrl}
                              download={file.name}
                              onClick={() => markSeen(file.id)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer transition-all shadow-3xs"
                              title="Télécharger"
                            >
                              <Download className="w-4 h-4 stroke-[2]" />
                            </a>
                          )}
                          <StatusActions
                            compact
                            status={file.submissionStatus}
                            onChange={(s) => { markSeen(file.id); onUpdateFileStatus(file.id, s); }}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <AntenneDashboardModal
        isOpen={selectedAntenneDashboardId !== null}
        onClose={() => setSelectedAntenneDashboardId(null)}
        antenneId={selectedAntenneDashboardId}
        antennes={antennes}
        files={files}
        folders={folders}
        orgProfiles={orgProfiles}
        onUpdateFileStatus={onUpdateFileStatus}
        onFilterWorkspace={(antId) => setActiveAntenneId(antId)}
        delegationFilterId={delegationFilterId}
      />

    </div>
  );
}
