import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Check, 
  ExternalLink,
  Users,
  Compass,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  PlaneTakeoff,
  Eye,
  Settings,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { DossierFile, Folder, Organization, SubmissionStatus } from '../types';
import { StatusBadge } from './ui';

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

// Simulated regional facts and contacts to customize the dashboard and make it feel authentic
const ANTENNE_METADATA: Record<string, {
  coordinator: string;
  phone: string;
  email: string;
  address: string;
  airport: string;
  planes: string[];
  activeMissions: number;
}> = {
  nantes: {
    coordinator: "Commandant Jean-Luc Morvan",
    phone: "+33 2 40 89 12 77",
    email: "antenne.nantes@asf-fr.org",
    address: "Aéroport de Nantes Atlantique, Hangar 4, 44340 Bouguenais",
    airport: "Nantes Atlantique (LFRS)",
    planes: ["Cessna 172 Skyhawk (F-GASF)", "Robin DR400 (F-HASF)"],
    activeMissions: 4,
  },
  paris: {
    coordinator: "Capitaine Hélène de Saint-Exupéry",
    phone: "+33 1 49 75 15 00",
    email: "antenne.paris@asf-fr.org",
    address: "Aéroport de Paris-Orly, Bureau d'aviation générale, 94390 Orly",
    airport: "Paris-Orly (LFPO)",
    planes: ["Socata TB-20 Trinidad (F-GBSF)", "Cessna Caravan (F-OASF)"],
    activeMissions: 8,
  },
  toulouse: {
    coordinator: "Commandant Antoine Mercier",
    phone: "+33 5 61 71 11 00",
    email: "antenne.toulouse@asf-fr.org",
    address: "Aéroport de Toulouse-Blagnac, Zone Aviation d'Affaires, 31700 Blagnac",
    airport: "Toulouse-Blagnac (LFBO)",
    planes: ["Cessna 172 Skyhawk (F-TBSF)", "Diamond DA40 (F-DSF)"],
    activeMissions: 6,
  },
  marseille: {
    coordinator: "Capitaine Marc Audibert",
    phone: "+33 4 42 14 00 12",
    email: "antenne.marseille@asf-fr.org",
    address: "Aéroport Marseille Provence, Zone de fret maritime, 13700 Marignane",
    airport: "Marseille Provence (LFML)",
    planes: ["Cessna 172 Skyhawk (F-MSF)"],
    activeMissions: 3,
  },
  lyon: {
    coordinator: "Commandant Valéry Bernard",
    phone: "+34 4 72 22 56 00",
    email: "antenne.lyon@asf-fr.org",
    address: "Aéroport de Lyon-Bron, Hangar Aviation Générale, 69500 Bron",
    airport: "Lyon-Bron (LFLY)",
    planes: ["Robin DR400 (F-LYSF)", "Cessna Caravan (F-PNSF)"],
    activeMissions: 5,
  },
  bordeaux: {
    coordinator: "Capitaine Sophie Giraud",
    phone: "+33 5 56 34 20 20",
    email: "antenne.bordeaux@asf-fr.org",
    address: "Aéroport de Bordeaux-Mérignac, Zone Nord Hangar 12, 33700 Mérignac",
    airport: "Bordeaux-Mérignac (LFBD)",
    planes: ["Diamond DA42 (F-BOSF)"],
    activeMissions: 4,
  },
  lille: {
    coordinator: "Commandant Pierre-Yves Leduc",
    phone: "+33 3 20 49 55 11",
    email: "antenne.lille@asf-fr.org",
    address: "Aéroport de Lille-Lesquin, Zone Fret, 59810 Lesquin",
    airport: "Lille-Lesquin (LFQQ)",
    planes: ["Cessna 172 Skyhawk (F-LISF)"],
    activeMissions: 2,
  },
  strasbourg: {
    coordinator: "Capitaine Frédéric Schmitt",
    phone: "+33 3 88 64 67 00",
    email: "antenne.strasbourg@asf-fr.org",
    address: "Aéroport de Strasbourg-Entzheim, RD 221, 67960 Entzheim",
    airport: "Strasbourg-Entzheim (LFST)",
    planes: ["Socata TB-10 Tobago (F-STSF)"],
    activeMissions: 3,
  }
};

const DEFAULTS_COORD = {
  coordinator: "Coordinateur des vols",
  phone: "+33 1 45 42 00 00",
  email: "antenne.france@asf-fr.org",
  address: "Aéroport local ASF",
  airport: "Aérodrome de rattachement",
  planes: ["Aéronef d'initiation (F-ASF)"],
  activeMissions: 2
};

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

  if (!isOpen || !antenneId) return null;

  // Find antenne meta
  const group = antennes[delegationFilterId] || [];
  const antenne = group.find(a => a.id === antenneId) || { id: antenneId, name: antenneId.toUpperCase() };

  const meta = ANTENNE_METADATA[antenneId] || DEFAULTS_COORD;

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
    if (rate >= 80) return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/35";
    if (rate >= 50) return "text-amber-600 bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900/40";
    return "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40";
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-4xl h-[90vh] max-h-[800px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden text-left"
        >
          {/* Header Banner - Sky or local customized layout */}
          <div className="relative bg-gradient-to-r from-deep via-azur to-deep-dark p-6 text-white shrink-0">
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
                  Aéroport de rattachement principal : <strong className="font-extrabold">{meta.airport}</strong>
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
                <span className="text-[10px] text-azur-pastel font-extrabold uppercase tracking-wide">Vols Planifiés</span>
                <div className="text-lg font-black mt-0.5 flex items-center gap-1.5">
                  <PlaneTakeoff className="w-4 h-4 text-azur-pastel" />
                  <span>{meta.activeMissions} missions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selection Row */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 px-6 py-1 shrink-0 gap-1.5">
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'stats'
                  ? 'border-azur text-azur dark:text-azur-pastel'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📊 Performance & Infos
            </button>
            <button
              onClick={() => setActiveTab('orgs')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'orgs'
                  ? 'border-azur text-azur dark:text-azur-pastel'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🏢 Organismes Affiliés ({localOrgs.length})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'documents'
                  ? 'border-azur text-azur dark:text-azur-pastel'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📁 Justificatifs & Contrôle ({localFiles.length})
            </button>
          </div>

          {/* Modal Content - Scrollable Box */}
          <div className="flex-grow overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/10">
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
                        <span className="text-xs font-bold text-slate-500 uppercase">Indice de Conformité Réglementaire</span>
                        <span className="text-xs font-mono font-bold text-azur">{validatedFiles}/{totalFiles} fichiers validés</span>
                      </div>
                      
                      {/* Simulated elegant progress gauge */}
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative border border-slate-200/40">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${complianceRate}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-gradient-to-r from-azur-pastel to-azur"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center mt-3 text-[10.5px] font-semibold text-slate-400">
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
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-slate-100">{meta.coordinator}</p>
                          <p className="text-xs text-slate-400 mt-1">Coordonnées de l'antenne locale d'Aviation Sans Frontières.</p>
                          
                          <div className="mt-3.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{meta.phone}</span>
                            </span>
                            <span className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span className="underline hover:text-azur">{meta.email}</span>
                            </span>
                          </div>
                        </div>

                        {/* Map marker detail block */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800/80 font-mono text-[10.5px] space-y-2 sm:max-w-[210px] sm:self-center">
                          <p className="text-slate-400 uppercase font-bold tracking-wider">📍 Localisation</p>
                          <p className="text-slate-700 dark:text-slate-300 font-sans font-bold leading-normal">{meta.address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Simulated Flight plans / Operations Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-3xs text-left">
                      <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800/60 pb-3 mb-3">
                        <PlaneTakeoff className="w-5 h-5 text-azur" />
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Missions & Vols Actifs "Ailes du Sourire"</h4>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="space-y-1">
                            <strong className="text-xs text-slate-800 dark:text-slate-200">Vol Découverte "Ailes 44"</strong>
                            <p className="text-[10px] text-slate-400">Simulation d'intégration / Initiation de vol adaptée</p>
                          </div>
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md border border-emerald-100">
                            PLANI : CE SAMEDI
                          </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="space-y-1">
                            <strong className="text-xs text-slate-800 dark:text-slate-200">Visite d'aérodrome locale</strong>
                            <p className="text-[10px] text-slate-400">Encadrement des enfants en situation de fragilité</p>
                          </div>
                          <span className="bg-azur-light text-azur text-[10px] font-bold px-2 py-1 rounded-md border border-azur/20">
                            VALIDÉ PAR COMM.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Action column */}
                  <div className="space-y-6">
                    {/* Workspace redirection */}
                    <div className="bg-azur-light dark:from-slate-950/20 dark:to-slate-950/50 dark:bg-none border border-azur/20 dark:border-slate-800 p-4.5 rounded-2xl text-left space-y-3 text-xs font-medium">
                      <Compass className="w-5 h-5 text-azur" />
                      <h4 className="font-extrabold text-azur">Accéder aux dossiers</h4>
                      <p className="text-slate-500 leading-normal">
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

                    {/* Regional aircraft info */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4.5 rounded-2xl text-left space-y-3 text-xs font-medium">
                      <h4 className="font-extrabold text-slate-700 dark:text-slate-300">Flotte d'aéronefs d'initiation</h4>
                      <div className="space-y-2">
                        {meta.planes.map((p, i) => (
                          <div key={i} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                            <span>✈️</span>
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
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
                    <span className="text-xs text-slate-400">{localOrgs.length} organismes rattachés</span>
                  </div>

                  {localOrgs.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
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

                              <p className="text-[11px] text-slate-400 mt-2 font-mono">ID : {org.id.substring(0, 10)}</p>
                              <div className="mt-3.5 space-y-1 text-xs text-slate-500">
                                <p>🧑‍💼 Liaison : <strong>{org.contactName}</strong></p>
                                <p>📧 Email : {org.email}</p>
                              </div>
                            </div>

                            <div className="border-t border-slate-50 dark:border-slate-800 mt-4 pt-3 flex items-center justify-between">
                              <span className="text-[10.5px] text-slate-400">{orgFilesCount} document{orgFilesCount !== 1 ? 's' : ''} versé{orgFilesCount !== 1 ? 's' : ''}</span>
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
                    <span className="text-xs text-slate-400 font-mono">{localFiles.length} justificatif(s)</span>
                  </div>

                  {localFiles.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/40 rounded-2xl text-xs text-slate-400">
                      Aucun document réglementaire n'est présent dans les bases pour l'instant dans l'antenne locale de {antenne.name}.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 shadow-3xs bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
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
                                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                    <div className="flex flex-col min-w-[200px] max-w-[420px]">
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block" title={file.name}>{file.name}</span>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                        <span className="text-[9.5px] text-slate-400 font-mono">ID: {file.id.substring(0, 8)}</span>
                                        <span className="text-[9px] text-slate-300">•</span>
                                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                          <span>Déposé par :</span>
                                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-tight ${
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
                                        className="p-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                                        title="Télécharger"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    <button
                                      onClick={() => onUpdateFileStatus(file.id, 'Validated')}
                                      className="p-1 rounded-md border border-emerald-100 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors"
                                      title="Valider de suite"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onUpdateFileStatus(file.id, 'Incomplete')}
                                      className="p-1 rounded-md border border-rose-100 text-rose-600 bg-rose-50 hover:bg-rose-100 cursor-pointer transition-colors"
                                      title="Rejeter"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
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
            <span className="text-slate-400 font-medium">Visualisation d'antenne - {antenne.name}</span>
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
