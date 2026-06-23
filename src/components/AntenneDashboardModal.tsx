import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeAntenneSettings, type AntenneSettings } from '../lib/antenneSettings';
import {
  X, 
  MapPin, 
  TrendingUp, 
  FileCheck2, 
  Clock, 
  AlertCircle, 
  Building2, 
  FileText, 
  Download, 
  ExternalLink,
  Users,
  Compass,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  Info,
  Eye,
  Settings,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { DossierFile, Folder, Organization, SubmissionStatus } from '../types';
import { StatusBadge, StatusActions } from './ui';

interface AntenneDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  antenneId: string | null;
  antennes: Record<string, { id: string; name: string; x?: number; y?: number }[]>;
  files: DossierFile[];
  folders: Folder[];
  orgProfiles: Organization[];
  onUpdateFileStatus: (fileId: string, status: SubmissionStatus) => void;
  onFilterWorkspace: (antenneId: string) => void;
  delegationFilterId: string;
}


export default function AntenneDashboardModal({
  isOpen,
  onClose,
  antenneId,
  antennes,
  files,
  folders,
  orgProfiles,
  onUpdateFileStatus,
  onFilterWorkspace,
  delegationFilterId,
}: AntenneDashboardModalProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'orgs' | 'documents'>('stats');
  // Profil réel de l'antenne (renseigné par le gestionnaire d'antenne). Aucune
  // donnée inventée : champ vide → « Non renseigné ».
  const [info, setInfo] = useState<AntenneSettings | null>(null);
  useEffect(() => {
    if (!isOpen || !antenneId) { setInfo(null); return; }
    return subscribeAntenneSettings(antenneId, setInfo);
  }, [isOpen, antenneId]);

  if (!isOpen || !antenneId) return null;

  // Find antenne meta
  const group = antennes[delegationFilterId] || [];
  const antenne = group.find(a => a.id === antenneId) || { id: antenneId, name: antenneId.toUpperCase() };

  // Valeur affichée ou repli « Non renseigné » (jamais de fausse donnée).
  const shown = (v?: string) => (v && v.trim() ? v : 'Non renseigné');

  // Query actual data for this antenne
  const localOrgs = orgProfiles.filter(org => org.antenne_id === antenneId);
  const localOrgIds = localOrgs.map(o => o.id);

  // Files belonging to this antenne (either direct or uploaders from this antenne)
  const localFiles = files.filter(f => {
    return f.antenne_id === antenneId || localOrgIds.includes(f.orgId);
  });

  // Folders for this local branch
  const localFolders = folders.filter(fol => fol.antenne_id === antenneId);

  // Stats calculation
  const totalFiles = localFiles.length;
  const pendingFiles = localFiles.filter(f => f.submissionStatus === 'Pending' || !f.submissionStatus).length;
  const underReviewFiles = localFiles.filter(f => f.submissionStatus === 'Under review').length;
  const validatedFiles = localFiles.filter(f => f.submissionStatus === 'Validated').length;
  const incompleteFiles = localFiles.filter(f => f.submissionStatus === 'Incomplete').length;

  const complianceRate = totalFiles > 0 ? Math.round((validatedFiles / totalFiles) * 100) : 0;

  // Render compliance badge
  const getComplianceColor = (rate: number) => {
    if (rate >= 80) return "text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/35";
    if (rate >= 50) return "text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900/40";
    return "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40";
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-4xl h-[90vh] max-h-[800px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden text-left"
        >
          {/* Header Banner - Sky or local customized layout */}
          <div className="relative bg-gradient-to-r from-deep via-azur to-deep-dark p-4 sm:p-6 text-white shrink-0">
            {/* Ambient flight vectors */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
            
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 bg-white/12 text-white/95 text-[9.5px] uppercase font-black px-2.5 py-1 rounded-full border border-white/20 select-none">
                  <Sparkles className="w-3 h-3 text-azur-pastel" /> Antenne Régionale Déployée
                </span>
                <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 mt-2">
                  <MapPin className="w-6 h-6 text-orange-400 fill-orange-400/20" />
                  <span>Direction Locale : {antenne.name}</span>
                </h2>
                <p className="text-xs text-slate-100/90 font-medium tracking-tight">
                  Aérodrome de rattachement : <strong className="font-extrabold">{shown(info?.airport)}</strong>
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-black/10 hover:bg-black/25 text-white/80 hover:text-white cursor-pointer transition-colors border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick KPI Row attached to Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-4 mt-6 border border-white/10">
              <div>
                <span className="text-[10px] text-azur-pastel font-extrabold uppercase tracking-wide">Taux de conformité</span>
                <div className="text-lg font-black flex items-center gap-1.5 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>{complianceRate}%</span>
                </div>
              </div>
              
              <div>
                <span className="text-[10px] text-azur-pastel font-extrabold uppercase tracking-wide">Organismes actifs</span>
                <div className="text-lg font-black mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-azur-pastel" />
                  <span>{localOrgs.length}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-azur-pastel font-extrabold uppercase tracking-wide">Fichiers à valider</span>
                <div className="text-lg font-black mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-300" />
                  <span>{pendingFiles + underReviewFiles}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-azur-pastel font-extrabold uppercase tracking-wide">Documents validés</span>
                <div className="text-lg font-black mt-0.5 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>{validatedFiles}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selection Row */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 px-4 sm:px-6 py-1 shrink-0 gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'border-azur text-azur dark:text-azur-pastel'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              📊 Performance & Infos
            </button>
            <button
              onClick={() => setActiveTab('orgs')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'orgs'
                  ? 'border-azur text-azur dark:text-azur-pastel'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              🏢 Organismes Affiliés ({localOrgs.length})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'border-azur text-azur dark:text-azur-pastel'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              📁 Justificatifs & Contrôle ({localFiles.length})
            </button>
          </div>

          {/* Modal Content - Scrollable Box */}
          <div className="flex-grow overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-950/10">
            <AnimatePresence mode="wait">
              {/* TAB 1: STATS & LOCAL ACTIVITIES */}
              {activeTab === 'stats' && (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  {/* Left stats card */}
                  <div className="space-y-6 md:col-span-2">
                    {/* Compliance Progress Gauge Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-3xs text-left">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Indice de Conformité Réglementaire</span>
                        <span className="text-xs font-mono font-bold text-azur">{validatedFiles}/{totalFiles} fichiers validés</span>
                      </div>
                      
                      {/* Simulated elegant progress gauge */}
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative border border-slate-200/40 dark:border-slate-700/40">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${complianceRate}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-gradient-to-r from-azur-pastel to-azur"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center mt-3 text-[10.5px] font-semibold text-slate-400 dark:text-slate-500">
                        <span>Alerte non conformes : {incompleteFiles}</span>
                        <span className={`px-2 py-0.5 rounded-md border ${getComplianceColor(complianceRate)} font-black`}>
                          STATUT : {complianceRate >= 80 ? 'EXCELLENT' : complianceRate >= 50 ? 'SATISFAISANT' : 'CONTRÔLE REQUIS'}
                        </span>
                      </div>
                    </div>

                    {/* Local Coordinator & Contact card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-3xs text-left space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800/60 pb-3">
                        <Users className="w-5 h-5 text-azur" />
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Coordinateur Référent d'Antenne</h4>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-slate-100">{shown(info?.coordinatorName)}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Coordonnées renseignées par l'antenne.</p>

                          <div className="mt-3.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span>{shown(info?.phone)}</span>
                            </span>
                            <span className="flex items-center gap-2 min-w-0">
                              <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              {info?.publicEmail
                                ? <a href={`mailto:${info.publicEmail}`} className="underline hover:text-azur truncate">{info.publicEmail}</a>
                                : <span>Non renseigné</span>}
                            </span>
                          </div>
                        </div>

                        {/* Aérodrome de rattachement */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800/80 font-mono text-[10.5px] space-y-2 sm:max-w-[210px] sm:self-center">
                          <p className="text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">📍 Aérodrome</p>
                          <p className="text-slate-700 dark:text-slate-300 font-sans font-bold leading-normal">{shown(info?.airport)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Présentation de l'antenne (texte libre renseigné par l'antenne) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-3xs text-left">
                      <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800/60 pb-3 mb-3">
                        <Info className="w-5 h-5 text-azur" />
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Présentation de l'antenne</h4>
                      </div>
                      {info?.description ? (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{info.description}</p>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Aucune présentation renseignée par l'antenne pour le moment.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Action column */}
                  <div className="space-y-6">
                    {/* Workspace redirection */}
                    <div className="bg-azur-light dark:bg-slate-950/40 border border-azur/20 dark:border-slate-800 p-4.5 rounded-2xl text-left space-y-3 text-xs font-medium">
                      <Compass className="w-5 h-5 text-azur" />
                      <h4 className="font-extrabold text-azur">Accéder aux dossiers</h4>
                      <p className="text-slate-500 dark:text-slate-400 leading-normal">
                        Focaliser complètement l'espace de transit réglementaire de la direction principale d'ASF sur l'antenne locale de {antenne.name}.
                      </p>
                      
                      <button
                        onClick={() => {
                          onFilterWorkspace(antenneId);
                          onClose();
                        }}
                        className="btn-asf w-full py-2 px-3 mt-2 text-xs"
                      >
                        <span>Filtrer cet espace sur {antenne.name}</span>
                        <ChevronRight className="w-4 h-4 shrink-0 animate-pulse" />
                      </button>
                    </div>

                    {/* Flotte (texte libre renseigné par l'antenne) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4.5 rounded-2xl text-left space-y-3 text-xs font-medium">
                      <h4 className="font-extrabold text-slate-700 dark:text-slate-300">Flotte d'aéronefs</h4>
                      {info?.aircraft ? (
                        <div className="flex gap-2 items-start bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
                          <span className="shrink-0">✈️</span>
                          <span className="whitespace-pre-wrap">{info.aircraft}</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Non renseigné par l'antenne.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: PARTNERS LIST */}
              {activeTab === 'orgs' && (
                <motion.div
                  key="orgs"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-display font-black text-deep dark:text-slate-200 uppercase">Organismes partenaires enregistrés</h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{localOrgs.length} organismes rattachés</span>
                  </div>

                  {localOrgs.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs text-slate-400 dark:text-slate-500">
                      Aucun organisme partenaire n'est actuellement rattaché de manière exclusive à l'antenne locale de {antenne.name}.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {localOrgs.map((org) => {
                        const orgFilesCount = files.filter(f => f.orgId === org.id).length;
                        return (
                          <div key={org.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-3xs relative group flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start">
                                <h4 className="text-xs font-extrabold text-deep dark:text-slate-200 uppercase tracking-tight truncate max-w-[210px]" title={org.name}>
                                  🏢 {org.name || "Partenaire non spécifié"}
                                </h4>
                                <StatusBadge status={org.submissionStatus} />
                              </div>

                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-mono">ID : {org.id.substring(0, 10)}</p>
                              <div className="mt-3.5 space-y-1 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                <p className="truncate" title={org.contactName}>🧑‍💼 Liaison : <strong>{org.contactName}</strong></p>
                                <p className="truncate" title={org.email}>📧 Email : {org.email}</p>
                              </div>
                            </div>

                            <div className="border-t border-slate-50 dark:border-slate-800 mt-4 pt-3 flex items-center justify-between">
                              <span className="text-[10.5px] text-slate-400 dark:text-slate-500">{orgFilesCount} document{orgFilesCount !== 1 ? 's' : ''} versé{orgFilesCount !== 1 ? 's' : ''}</span>
                              <button
                                onClick={() => {
                                  onFilterWorkspace(antenneId);
                                  onClose();
                                }}
                                className="text-[10px] font-black text-azur hover:underline flex items-center gap-0.5"
                              >
                                <span>Voir le cabinet</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB 3: DOCUMENTS TABLE & FAST VALIDATION */}
              {activeTab === 'documents' && (
                <motion.div
                  key="documents"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4 text-left"
                >
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-display font-black text-deep dark:text-slate-200 uppercase">Documents transmis par l'antenne</h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{localFiles.length} justificatif(s)</span>
                  </div>

                  {localFiles.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-700/40 rounded-2xl text-xs text-slate-400 dark:text-slate-500">
                      Aucun document réglementaire n'est présent dans les bases pour l'instant dans l'antenne locale de {antenne.name}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 shadow-3xs bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse min-w-[640px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="px-4 py-2.5">Titre du fichier</th>
                            <th className="px-3 py-2.5">Organisme</th>
                            <th className="px-3 py-2.5">Statut Actuel</th>
                            <th className="px-4 py-2.5 text-right font-black">Actions de vérification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                          {localFiles.map((file) => {
                            const partner = orgProfiles.find(p => p.id === file.orgId);
                            const fileStatus = file.submissionStatus || 'Pending';
                            const uploaderName = file.uploadedBy === 'admin' ? 'admin' : (partner?.name || 'Organisme');

                            return (
                              <tr key={file.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/40 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                                    <div className="flex flex-col min-w-0 max-w-[420px]">
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block" title={file.name}>{file.name}</span>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono">ID: {file.id.substring(0, 8)}</span>
                                        <span className="text-[9px] text-slate-300 dark:text-slate-600">•</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                          <span>Déposé par :</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight ${
                                            file.uploadedBy === 'admin'
                                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50'
                                              : 'bg-azur/10 text-azur dark:bg-azur/15 border border-azur/20'
                                          }`}>{uploaderName}</span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                
                                <td className="px-3 py-3 text-xs text-azur font-bold">
                                  {partner?.name || 'Inconnu'}
                                </td>

                                <td className="px-3 py-3">
                                  <StatusBadge status={fileStatus} />
                                </td>

                                <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end gap-1">
                                    {file.fallbackDataUrl && (
                                      <a
                                        href={file.fallbackDataUrl}
                                        download={file.name}
                                        className="p-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                        title="Télécharger"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    <StatusActions
                                      compact
                                      status={fileStatus}
                                      onChange={(s) => onUpdateFileStatus(file.id, s)}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Modal Footer Controls */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Visualisation d'antenne - {antenne.name}</span>
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              Fermer l'aperçu
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
