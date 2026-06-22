import React, { useState } from 'react';
import {
  FileText,
  Download,
  Check,
  X,
  ExternalLink,
  Search,
  RotateCw,
  TrendingUp,
  FolderOpen,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DossierFile, Folder, Organization, SubmissionStatus } from '../types';
import { StatusBadge } from './ui';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAntenneDashboardId, setSelectedAntenneDashboardId] = useState<string | null>(null);

  // Find antenne helper
  const getAntenneInfo = (file: DossierFile, org?: Organization) => {
    const antId = file.antenne_id || org?.antenne_id;
    if (!antId) return null;
    
    // Look up in delegation or globally
    const group = antennes[delegationFilterId] || [];
    return group.find(a => a.id === antId) || { id: antId, name: antId.toUpperCase() };
  };

  // Filter files requiring attention (Pending, Under review, or Incomplete)
  const attentionFiles = files.filter(f => {
    const status = f.submissionStatus || 'Pending';
    // Files that are NOT validated yet
    return status !== 'Validated';
  });

  // Apply search filtering
  const filteredFiles = attentionFiles.filter(f => {
    const org = orgProfiles.find(p => p.id === f.orgId);
    const orgName = org?.name || 'Organisme Inconnu';
    const antenneName = getAntenneInfo(f, org)?.name || 'Sans antenne';
    const fileMatches = f.name.toLowerCase().includes(searchTerm.toLowerCase());
    const orgMatches = orgName.toLowerCase().includes(searchTerm.toLowerCase());
    const antenneMatches = antenneName.toLowerCase().includes(searchTerm.toLowerCase());
    return fileMatches || orgMatches || antenneMatches;
  });

  // Calculate percentage of validated files overall
  const totalFilesCount = files.length;
  const validatedFilesCount = files.filter(f => f.submissionStatus === 'Validated').length;
  const validationRate = totalFilesCount > 0 ? Math.round((validatedFilesCount / totalFilesCount) * 100) : 0;

  const handleCycleStatus = (fileId: string, currentStatus?: SubmissionStatus) => {
    // Cycles between Under review (En cours d'analyse) -> Incomplete -> Pending -> Under review
    const statusCycle: Record<string, SubmissionStatus> = {
      'Pending': 'Under review',
      'Under review': 'Incomplete',
      'Incomplete': 'Pending'
    };
    const nextStatus = statusCycle[currentStatus || 'Pending'] || 'Under review';
    onUpdateFileStatus(fileId, nextStatus);
  };

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800/80 p-4 sm:p-6 shadow-sm overflow-hidden text-left relative">
      
      {/* Decorative gradient header backdrop */}
      <div className={`absolute top-0 left-0 right-0 h-[5px] ${themeAttr?.gradientClass || 'bg-azur'}`} />

      {/* Header and Counters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className={`w-5 h-5 ${themeAttr?.accentText || 'text-azur'}`} />
            <h3 className="text-base font-display font-black tracking-tight text-deep dark:text-slate-100 uppercase">
              📂 Documents nécessitant votre attention
            </h3>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
            Liste consolidée des justificatifs et déclarations de vol en attente de vérification par la direction.
          </p>
        </div>
        
        {/* Quick stat cards */}
        <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
          {/* Attention indicator badge */}
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs px-3.5 py-1.5 rounded-2xl font-black flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            <span>À traiter : {attentionFiles.length} dossiers</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs px-3.5 py-1.5 rounded-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-xs" />
            <span>Conformité : {validationRate}%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <Search className="h-4 h-4 text-slate-400" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par document, organisme partenaire ou antenne..."
          className="input-asf pl-10 text-xs font-semibold rounded-2xl dark:bg-slate-950/40 dark:border-slate-800 dark:text-slate-100"
        />
      </div>

      {/* Main Attention Table Area */}
      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Check className="w-9 h-9 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-full mb-3 shadow-xs" />
          <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
            {searchTerm ? "Aucun document ne correspond à ce filtre." : "Félicitations ! Excellent travail."}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[340px]">
            {searchTerm 
              ? "Essayez de modifier votre requête ou d'effacer les filtres de recherche."
              : "Tous les justificatifs réglementaires de vol ont été passés en revue et validés avec succès."
            }
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-3xs">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3 w-[45%]">Document & Organisme</th>
                <th className="px-4 py-3 w-[18%]">Antenne de rattachement</th>
                <th className="px-4 py-3 w-[15%]">Versé le</th>
                <th className="px-4 py-3 w-[12%]">Statut Actuel</th>
                <th className="px-5 py-3 text-right w-[10%]">Validation Instantanée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/30">
              <AnimatePresence initial={false}>
                {filteredFiles.map((file) => {
                  const org = orgProfiles.find(p => p.id === file.orgId);
                  const antenneInfo = getAntenneInfo(file, org);

                  return (
                    <motion.tr
                      key={file.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-950/40 transition-colors group"
                    >
                      {/* Document details column */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-3xs">
                            <FileText className="w-4 h-4 text-slate-400 group-hover:text-azur transition-colors" />
                          </div>
                          <div>
                            <p className="text-xs font-display font-black text-deep dark:text-slate-200 line-clamp-1 leading-snug">
                              {file.name}
                            </p>
                            <p className="text-[10px] font-black text-azur dark:text-azur mt-0.5 uppercase tracking-wide">
                              🏢 {org?.name || 'Compagnie Partenaire'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Antenne target selection */}
                      <td className="px-4 py-4">
                        {antenneInfo ? (
                          <button
                            onClick={() => setSelectedAntenneDashboardId(antenneInfo.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-azur hover:text-azur-hover dark:text-azur dark:hover:text-azur-pastel uppercase tracking-tight bg-azur/5 dark:bg-azur/5 hover:bg-azur/10 border border-azur/10 dark:border-azur/10 px-2 py-1 rounded-xl transition-all cursor-pointer"
                            title="Voir le dashboard personnalisé d'antenne"
                          >
                            <span>📍 {antenneInfo.name}</span>
                            <ExternalLink className="w-3 h-3 text-[11px] text-slate-400 shrink-0" />
                          </button>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-800 px-2 py-1 rounded-xl bg-slate-50/50 dark:bg-slate-950/10">
                            📍 SANS ANTENNE
                          </span>
                        )}
                      </td>

                      {/* Date details */}
                      <td className="px-4 py-4 text-slate-500 dark:text-slate-400 text-xs font-semibold font-mono">
                        {file.uploadDate ? new Date(file.uploadDate).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : '15/06/2026'}
                      </td>

                      {/* Status flag */}
                      <td className="px-4 py-4">
                        <StatusBadge status={file.submissionStatus || 'Pending'} />
                      </td>

                      {/* Instant validation actions */}
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5 opacity-85 group-hover:opacity-100 transition-opacity">
                          
                          {/* File download url helper */}
                          {file.fallbackDataUrl && (
                            <a
                              href={file.fallbackDataUrl}
                              download={file.name}
                              className="p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer transition-all shadow-3xs"
                              title="Télécharger le document"
                            >
                              <Download className="w-4 h-4 stroke-[2]" />
                            </a>
                          )}

                          {/* Cycle or Reevaluate action */}
                          <button
                            onClick={() => handleCycleStatus(file.id, file.submissionStatus)}
                            className="p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer transition-all shadow-3xs"
                            title="Changer le statut temporaire"
                          >
                            <RotateCw className="w-4 h-4 stroke-[2]" />
                          </button>

                          {/* Validate completely */}
                          <button
                            onClick={() => onUpdateFileStatus(file.id, 'Validated')}
                            className="p-1 px-1.5 rounded-lg border border-emerald-100 hover:border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100/60 cursor-pointer transition-all shadow-3xs"
                            title="Marquer comme conforme & validé"
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </button>

                          {/* Refuse/Reject */}
                          <button
                            onClick={() => onUpdateFileStatus(file.id, 'Incomplete')}
                            className="p-1 px-1.5 rounded-lg border border-rose-100 hover:border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100/60 cursor-pointer transition-all shadow-3xs"
                            title="Rejeter ou déclarer incomplet"
                          >
                            <X className="w-4 h-4 stroke-[2.5]" />
                          </button>

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

      {/* Info footer box */}
      <div className="mt-4 flex items-start gap-2 text-[10.5px] leading-relaxed text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          En cliquant sur l'étiquette d'une <strong className="font-extrabold text-slate-600 dark:text-slate-400">Antenne de rattachement</strong>, un tableau de bord complet et personnalisé par antenne locale s'ouvrira, vous permettant de suivre les statistiques, d'accéder aux partenaires, et de valider les documents.
        </span>
      </div>

      {/* Antenne Dashboard Modal */}
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
