import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  addDoc,
  setDoc
} from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Organization, DossierFile, Folder, SubmissionStatus, AntenneGroup } from '../types';
import { 
  ShieldAlert, 
  LogOut,
  FileText,
  Download,
  Archive,
  Trash2,
  Users, 
  Layers,
  MapPin,
  Building2,
  FolderOpen,
  ArrowLeft,
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  CloudUpload,
  Clock,
  RefreshCw,
  AlertCircle,
  Plus,
  CheckCircle2,
  Edit2,
  Settings,
  HelpCircle,
  ChevronDown,
  CornerLeftUp,
  Search,
  X,
  GraduationCap,
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFeedback } from '../hooks/useFeedback';
import DeleteConfirmModal from './DeleteConfirmModal';
import FilePreviewModal from './FilePreviewModal';
import CreateFolderModal from './CreateFolderModal';
import UserProfileModal from './UserProfileModal';
import OrgCabinetModal from './OrgCabinetModal';
import { LogoASF } from './LandingPage';
import AilesDuSourireDashboard from './AilesDuSourireDashboard';
import AntenneGroupsManager from './AntenneGroupsManager';
import AntenneAdminsManager from './AntenneAdminsManager';
import AuditLogPanel from './AuditLogPanel';
import { localDb } from '../lib/localDb';
import { logAction, subscribeAuditLogs, type AuditLog } from '../lib/auditLog';
import { readFileAsDataUrl, deleteFileArtifacts } from '../lib/fileTransfer';
import { downloadFilesAsZip } from '../lib/zip';
import { formatBytes } from '../lib/utils';
import { setAntenneMembership, removeAntenneFromAllGroups, toggleAntenneInGroup } from '../lib/antenneGroups';
import { StatusBadge, ComplianceBar, ComplianceRing, GuidedTour, type TourStep } from './ui';
import { STATUS_META, STATUS_ORDER, getStatusMeta } from '../lib/status';
import { lonLatToXY, geocodeCity, FRANCE_MAINLAND, FRANCE_CORSICA, toSvgPoints } from '../lib/franceGeo';

// Libellé + style de badge pour chaque rôle de compte.
const ROLE_META: Record<string, { label: string; className: string; icon: string }> = {
  super_admin: { label: 'Super administrateur', icon: '👑', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  admin: { label: 'Administrateur', icon: '🛡️', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  admin_delegation: { label: 'Coordinateur de délégation', icon: '⛵', className: 'bg-azur-light text-azur-dark border-azur-pastel' },
  admin_antenne: { label: "Gestionnaire d'antenne", icon: '📍', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  organization: { label: 'Partenaire / Organisme', icon: '🏢', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const roleMeta = (role?: string) => ROLE_META[role || 'organization'] || ROLE_META.organization;

// Pseudo-dossier regroupant les fichiers d'une antenne déposés hors dossier
// (uploadés par un partenaire directement à la racine de son espace).
const UNFILED_FOLDER_ID = '__unfiled__';

const DELEGATION_THEMES: Record<string, {
  colorClass: string;
  gradientClass: string;
  badgeClass: string;
  bgDecorative: string;
  icon: string;
  bannerBorder: string;
  accentText: string;
  hoverAccent: string;
  ringColor: string;
}> = {
  'ouest': {
    colorClass: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30',
    gradientClass: 'from-indigo-500/10 to-azur/5',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900',
    bgDecorative: 'bg-indigo-500/10',
    icon: '⛵',
    bannerBorder: 'border-indigo-100 dark:border-indigo-900/60',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    hoverAccent: 'hover:border-indigo-400 hover:bg-indigo-50/10 hover:shadow-indigo-500/5',
    ringColor: 'focus:ring-indigo-500'
  },
  'occitanie': {
    colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/30',
    gradientClass: 'from-rose-500/10 to-amber-500/5',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900',
    bgDecorative: 'bg-rose-500/10',
    icon: '⛰️',
    bannerBorder: 'border-rose-100 dark:border-rose-900/60',
    accentText: 'text-rose-600 dark:text-rose-400',
    hoverAccent: 'hover:border-rose-400 hover:bg-rose-50/10 hover:shadow-rose-500/5',
    ringColor: 'focus:ring-rose-500'
  },
  'sud-est': {
    colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/30',
    gradientClass: 'from-blue-500/10 to-indigo-500/5',
    badgeClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900',
    bgDecorative: 'bg-blue-500/10',
    icon: '🌊',
    bannerBorder: 'border-blue-100 dark:border-blue-900/60',
    accentText: 'text-blue-600 dark:text-blue-400',
    hoverAccent: 'hover:border-blue-400 hover:bg-blue-50/10 hover:shadow-blue-500/5',
    ringColor: 'focus:ring-blue-500'
  },
  'antilles': {
    colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30',
    gradientClass: 'from-emerald-500/10 to-cyan-500/5',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900',
    bgDecorative: 'bg-emerald-500/10',
    icon: '📍',
    bannerBorder: 'border-emerald-100 dark:border-emerald-900/60',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    hoverAccent: 'hover:border-emerald-400 hover:bg-emerald-50/10 hover:shadow-emerald-500/5',
    ringColor: 'focus:ring-emerald-500'
  },
  'default': {
    colorClass: 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40',
    gradientClass: 'from-slate-500/5 to-slate-600/5',
    badgeClass: 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    bgDecorative: 'bg-slate-500/5',
    icon: '📍',
    bannerBorder: 'border-slate-200 dark:border-slate-800/60',
    accentText: 'text-slate-700 dark:text-slate-300',
    hoverAccent: 'hover:border-slate-400 hover:bg-slate-50/10',
    ringColor: 'focus:ring-slate-500'
  }
};

export default function AdminPanel() {
  const { organization, signOut, delegations: DELEGATIONS, antennes: ANTENNES_BY_DELEGATION, antenneGroups } = useAuth();
  const { themeConfig } = useTheme();
  const { toast, confirm } = useFeedback();

  // Mode d'affichage : super_admin (national complet) ou admin (national HQ).
  const [simulationRole, setSimulationRole] = useState<'super_admin' | 'admin'>(() => {
    if (organization?.role === 'admin') {
      return 'admin';
    }
    return 'super_admin';
  });

  const isSuperAdminMode = simulationRole === 'super_admin';

  const [activeDelegationId, setActiveDelegationId] = useState<string | null>(
    organization?.role === 'admin' && organization?.delegation_id ? organization.delegation_id : 'france',
  );
  const delegationFilterId = activeDelegationId ?? 'france';
  const [tempCoords, setTempCoords] = useState<{ x: number; y: number } | null>(null);

  // New State for full interactive Visual Antenna Editing
  const [editingAntenne, setEditingAntenne] = useState<{ id: string; name: string; x: number; y: number } | null>(null);

  // Selected Town (onglet de ville)
  const [activeAntenneId, setActiveAntenneId] = useState<string | null>(null);

  // Auto-select antenna for a national admin scoped to a single antenne.
  useEffect(() => {
    if (organization?.role === 'admin' && organization?.antenne_id) {
      setSimulationRole('admin');
      setActiveAntenneId(organization.antenne_id);
    }
  }, [organization]);

  // Selected Partner Folder (Dossier Organisme)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Firestore collections states
  const [files, setFiles] = useState<DossierFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [orgProfiles, setOrgProfiles] = useState<Organization[]>([]);

  // Search, sorting, filters states
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [fileStatusFilter, setFileStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [activeTour, setActiveTour] = useState<TourStep[] | null>(null);
  const [sortBy, setSortBy] = useState('date-desc');

  // Multi-tab support: workspaces for dossiers, members for validation and user access, plus config for superadmin
  const [activeTab, setActiveTab] = useState<'workspaces' | 'members' | 'delegations'>('workspaces');

  // Simple Admin Navigation Hub State
  const [navigationView, setNavigationView] = useState<'hub' | 'ailes' | 'users' | 'implantations' | 'logs'>('hub');

  // Account editing states
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editDelegation, setEditDelegation] = useState('');
  const [editAntenne, setEditAntenne] = useState('');

  // Modals & UI states
  const [fileToDelete, setFileToDelete] = useState<DossierFile | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [previewingFile, setPreviewingFile] = useState<DossierFile | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // New delegations / antennas inputs state
  const [newDelegationName, setNewDelegationName] = useState('');
  const [newDelegationId, setNewDelegationId] = useState('');
  const [newAntenneName, setNewAntenneName] = useState('');
  const [newAntenneId, setNewAntenneId] = useState('');
  const [newAntenneGroupIds, setNewAntenneGroupIds] = useState<string[]>([]);
  const [selectedDelegationForAntenne, setSelectedDelegationForAntenne] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  // Géocodage automatique : place le marqueur sur les vraies coordonnées de la
  // ville tapée (répertoire local + API adresse.data.gouv.fr), en mode création.
  useEffect(() => {
    if (editingAntenne) return;
    const name = newAntenneName.trim();
    if (name.length < 2) return;
    let cancelled = false;
    setGeocoding(true);
    const timer = setTimeout(async () => {
      const coords = await geocodeCity(name);
      if (!cancelled) {
        if (coords) setTempCoords(lonLatToXY(coords[0], coords[1]));
        setGeocoding(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setGeocoding(false);
    };
  }, [newAntenneName, editingAntenne]);

  const handleAddDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelegationName.trim() || !newDelegationId.trim()) return;
    setActionLoading(true);
    try {
      const cleanId = newDelegationId.toLowerCase().trim();
      await setDoc(doc(db, 'delegations', cleanId), {
        name: newDelegationName.trim()
      });
      logAction('delegation_create', {
        targetType: 'delegation',
        targetId: cleanId,
        targetName: newDelegationName.trim(),
        delegation_id: cleanId,
      });
      setNewDelegationName('');
      setNewDelegationId('');
    } catch (err: any) {
      console.error("Error creating delegation:", err);
      toast("Erreur lors de la création de la délégation : " + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAntenne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAntenneName.trim() || !newAntenneId.trim()) return;
    if (localDb.isSandboxActive()) {
      toast("La gestion des antennes est indisponible en mode hors-ligne (sandbox).", 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const cleanId = newAntenneId.toLowerCase().trim();
      const coordX = tempCoords ? tempCoords.x : 50;
      const coordY = tempCoords ? tempCoords.y : 50;
      await setDoc(doc(db, 'antennes', cleanId), {
        name: newAntenneName.trim(),
        delegation_id: delegationFilterId || 'france',
        x: coordX,
        y: coordY,
        createdAt: Date.now(),
        deleted: false
      });
      // Inclure la nouvelle antenne dans les groupes cochés.
      if (newAntenneGroupIds.length > 0) {
        try {
          await setAntenneMembership(cleanId, newAntenneGroupIds, antenneGroups);
        } catch (groupErr) {
          console.error("Error assigning antenne groups:", groupErr);
        }
      }
      logAction('antenne_create', {
        targetType: 'antenne',
        targetId: cleanId,
        targetName: newAntenneName.trim(),
        delegation_id: delegationFilterId || 'france',
        antenne_id: cleanId,
      });
      setNewAntenneName('');
      setNewAntenneId('');
      setNewAntenneGroupIds([]);
      setTempCoords(null);
    } catch (err: any) {
      console.error("Error creating antenne:", err);
      toast("Erreur lors de la création de l'antenne : " + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAntenne = async (antId: string) => {
    if (!await confirm(`Voulez-vous vraiment supprimer l'antenne "${antId}" ?`)) return;
    if (localDb.isSandboxActive()) {
      toast("La gestion des antennes est indisponible en mode hors-ligne (sandbox).", 'warning');
      return;
    }
    setActionLoading(true);
    try {
      // Retrouver l'antenne (et sa délégation) pour écrire un document valide
      // même lorsqu'elle n'existe pas encore dans Firestore (antennes par
      // défaut) : un setDoc/merge agit alors comme une création et la règle
      // isValidAntenne exige name + delegation_id.
      let antDelegationId = delegationFilterId || 'france';
      let antData: { id: string; name: string; x?: number; y?: number } | undefined;
      for (const [delId, list] of Object.entries(ANTENNES_BY_DELEGATION) as [string, { id: string; name: string; x?: number; y?: number }[]][]) {
        const found = (list || []).find(a => a.id === antId);
        if (found) {
          antDelegationId = delId;
          antData = found;
          break;
        }
      }
      await setDoc(doc(db, 'antennes', antId), {
        name: antData?.name || antId,
        delegation_id: antDelegationId,
        x: antData?.x ?? null,
        y: antData?.y ?? null,
        deleted: true,
        updatedAt: Date.now()
      }, { merge: true });
      // Nettoyage : retirer cette antenne de tous les groupes qui la contiennent.
      try {
        await removeAntenneFromAllGroups(antId, antenneGroups);
      } catch (groupErr) {
        console.error("Error cleaning antenne from groups:", groupErr);
      }
      logAction('antenne_delete', {
        targetType: 'antenne',
        targetId: antId,
        targetName: antData?.name || antId,
        delegation_id: antDelegationId,
        antenne_id: antId,
      });
      if (editingAntenne?.id === antId) {
        setEditingAntenne(null);
      }
    } catch (err: any) {
      console.error("Error deleting antenne:", err);
      toast("Erreur lors de la suppression de l'antenne : " + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAntenneDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAntenne || !editingAntenne.name.trim()) return;
    if (localDb.isSandboxActive()) {
      toast("La gestion des antennes est indisponible en mode hors-ligne (sandbox).", 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await setDoc(doc(db, 'antennes', editingAntenne.id), {
        name: editingAntenne.name.trim(),
        x: editingAntenne.x,
        y: editingAntenne.y,
        updatedAt: Date.now()
      }, { merge: true });
      logAction('antenne_update', {
        targetType: 'antenne',
        targetId: editingAntenne.id,
        targetName: editingAntenne.name.trim(),
        antenne_id: editingAntenne.id,
        delegation_id: delegationFilterId || '',
        details: "Modification des informations de l'antenne",
      });
      setEditingAntenne(null);
    } catch (err: any) {
      console.error("Error updating antenne:", err);
      toast("Erreur lors de la modification de l'antenne : " + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Recale toutes les antennes existantes sur les vraies coordonnées de leur
  // ville (géocodage par nom) et persiste les positions corrigées en base.
  const handleRecalibrateAllAntennes = async () => {
    if (localDb.isSandboxActive()) {
      toast("Le recalage des antennes est indisponible en mode hors-ligne (sandbox).", 'warning');
      return;
    }
    setRecalibrating(true);
    let updated = 0;
    let notFound = 0;
    let already = 0;
    const missing: string[] = [];
    try {
      const entries = Object.entries(ANTENNES_BY_DELEGATION) as [string, { id: string; name: string; x?: number; y?: number }[]][];
      for (const [delId, list] of entries) {
        for (const ant of list) {
          const coords = await geocodeCity(ant.name);
          if (!coords) {
            notFound++;
            missing.push(ant.name);
            continue;
          }
          const { x, y } = lonLatToXY(coords[0], coords[1]);
          // Déjà bien placée (tolérance 0,2 %) : on ne réécrit pas.
          if (ant.x !== undefined && ant.y !== undefined &&
              Math.abs(ant.x - x) < 0.2 && Math.abs(ant.y - y) < 0.2) {
            already++;
            continue;
          }
          await setDoc(doc(db, 'antennes', ant.id), {
            name: ant.name,
            delegation_id: delId,
            x,
            y,
            updatedAt: Date.now(),
          }, { merge: true });
          updated++;
        }
      }
      const parts = [`${updated} antenne(s) replacée(s)`];
      if (already) parts.push(`${already} déjà correcte(s)`);
      if (notFound) parts.push(`${notFound} ville(s) introuvable(s)${missing.length ? ' : ' + missing.join(', ') : ''}`);
      if (updated > 0) {
        logAction('antenne_update', {
          targetType: 'antenne',
          targetName: 'Recalage géographique',
          details: `${updated} antenne(s) repositionnée(s) sur la carte`,
        });
      }
      toast(parts.join(' · '), notFound ? 'warning' : 'success');
    } catch (err: any) {
      console.error("Error recalibrating antennes:", err);
      toast("Erreur lors du recalage des antennes : " + err.message, 'error');
    } finally {
      setRecalibrating(false);
    }
  };

  // Rendu d'une carte d'antenne (liste récapitulative), réutilisé pour chaque
  // groupe d'antennes.
  const renderAntenneCard = (ant: { id: string; name: string; x?: number; y?: number }) => {
    const countFolders = folders.filter(fol => fol.antenne_id === ant.id).length;
    const hasCoordinators = orgProfiles.filter(p => p.antenne_id === ant.id).length;
    const isCurrentlySel = editingAntenne?.id === ant.id;
    const startEdit = () => {
      setEditingAntenne({
        id: ant.id,
        name: ant.name,
        x: ant.x !== undefined ? ant.x : 50,
        y: ant.y !== undefined ? ant.y : 50,
      });
      setTempCoords(null);
    };
    return (
      <div
        key={ant.id}
        className={`flex justify-between items-center p-4 rounded-2xl border transition-all duration-200 ${
          isCurrentlySel
            ? "bg-amber-500/5 dark:bg-amber-500/2 border-amber-500/40 shadow-xs ring-1 ring-amber-500/10"
            : "bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800 hover:border-azur/40"
        }`}
      >
        <div className="space-y-1 text-left">
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 hover:text-azur-hover dark:hover:text-azur transition-colors text-left"
          >
            <span className={`w-2 h-2 rounded-full ${isCurrentlySel ? 'bg-amber-500 animate-ping' : 'bg-azur'}`}></span>
            <span>{ant.name}</span>
          </button>
          <p className="text-[10px] text-slate-400 font-mono">
            ID: {ant.id} • {ant.x !== undefined ? `${ant.x}%` : '50%'} X, {ant.y !== undefined ? `${ant.y}%` : '50%'} Y
          </p>
          <div className="flex gap-2 text-[9.5px] text-slate-500">
            <span>📂 {countFolders} dossiers</span>
            <span>🏢 {hasCoordinators} partenaires</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={startEdit}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isCurrentlySel
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "hover:bg-azur-light dark:hover:bg-deep-dark/40 text-azur-hover border-transparent hover:border-azur-pastel dark:hover:border-deep/40"
            }`}
            title="Modifier visuellement cette antenne"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleDeleteAntenne(ant.id)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg hover:text-rose-600 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40 transition-all cursor-pointer"
            title="Supprimer cette antenne de la carte"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Téléchargement groupé en archive .zip (documents affichés).
  const [zipping, setZipping] = useState(false);
  const handleExportZip = async (targets: DossierFile[]) => {
    if (!targets.length) return;
    setZipping(true);
    try {
      const name = `documents_${delegationFilterId || 'asf'}_${new Date().toISOString().split('T')[0]}`;
      const { zipped, failed } = await downloadFilesAsZip(targets, name);
      if (zipped > 0 && failed.length === 0) toast(`Archive de ${zipped} document(s) téléchargée ✓`, 'success');
      else if (zipped > 0) toast(`${zipped} document(s) archivé(s) · ${failed.length} téléchargé(s) à part.`, 'warning');
      else toast("Aucun document n'a pu être archivé ; téléchargement séparé.", 'warning');
    } catch (e) {
      console.error('zip failed', e);
      toast("Échec de la création de l'archive.", 'error');
    } finally {
      setZipping(false);
    }
  };

  const handleExportComplianceReport = () => {
    const dataRows = [
      ["Antenne", "Nombre d'Organismes (Dossiers)", "Fichiers Total", "En Attente", "Valides", "Non Conformes (Incomplets)"]
    ];

    const currentAntennes = delegationFilterId 
      ? (ANTENNES_BY_DELEGATION[delegationFilterId] || []) 
      : (ANTENNES_BY_DELEGATION['france'] || []);

    currentAntennes.forEach(ant => {
      const antFolders = folders.filter(fol => fol.antenne_id === ant.id);
      const antFiles = files.filter(f => f.antenne_id === ant.id);
      const pending = antFiles.filter(f => f.submissionStatus === 'Pending' || !f.submissionStatus).length;
      const validated = antFiles.filter(f => f.submissionStatus === 'Validated').length;
      const incomplete = antFiles.filter(f => f.submissionStatus === 'Incomplete').length;

      dataRows.push([
        ant.name,
        antFolders.length.toString(),
        antFiles.length.toString(),
        pending.toString(),
        validated.toString(),
        incomplete.toString()
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + dataRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_conformite_${delegationFilterId || 'global'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // User Profile Document & Files Management states
  const [selectedOrgForFiles, setSelectedOrgForFiles] = useState<Organization | null>(null);
  const [renamingFile, setRenamingFile] = useState<DossierFile | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // User management / Permissions helpers
  const handleUpdateOrgStatus = async (orgId: string, status: SubmissionStatus) => {
    const known = orgProfiles.find(o => o.id === orgId);
    const logIt = () => logAction('org_status_change', {
      targetType: 'organization',
      targetId: orgId,
      targetName: known?.name || orgId,
      antenne_id: known?.antenne_id,
      delegation_id: known?.delegation_id,
      details: status === 'Incomplete' ? 'Compte suspendu (dépôt bloqué)' : `Statut du compte : ${status}`,
    });
    if (localDb.isSandboxActive()) {
      const orgs = localDb.getOrganizations();
      const target = orgs.find(o => o.id === orgId);
      if (target) {
        target.submissionStatus = status;
        target.updatedAt = Date.now();
        localDb.saveOrganization(target);
      }
      setOrgProfiles(localDb.getOrganizations());
      logIt();
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        submissionStatus: status,
        updatedAt: Date.now()
      });
      logIt();
    } catch (err) {
      console.error("Error updating organization space state:", err);
    }
  };

  const handleUpdateOrgRole = async (orgId: string, newRole: string) => {
    const known = orgProfiles.find(o => o.id === orgId);
    const logIt = () => logAction('org_role_change', {
      targetType: 'organization',
      targetId: orgId,
      targetName: known?.name || orgId,
      antenne_id: known?.antenne_id,
      delegation_id: known?.delegation_id,
      details: `Rôle modifié : ${known?.role || '?'} → ${newRole}`,
    });
    if (localDb.isSandboxActive()) {
      const orgs = localDb.getOrganizations();
      const target = orgs.find(o => o.id === orgId);
      if (target) {
        target.role = newRole as any;
        target.updatedAt = Date.now();
        localDb.saveOrganization(target);
      }
      setOrgProfiles(localDb.getOrganizations());
      logIt();
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        role: newRole,
        updatedAt: Date.now()
      });
      logIt();
    } catch (err) {
      console.error("Error updating user role:", err);
    }
  };

  const handleDeleteOrg = async (org: Organization) => {
    const label = org.name || org.contactName || org.email || org.id;
    const ok = await confirm(
      `Supprimer définitivement le compte « ${label} » ?\n\nCette action est irréversible. Le profil partenaire sera retiré ; ses fichiers déjà déposés ne seront pas effacés.`,
    );
    if (!ok) return;
    const logIt = () => logAction('org_delete', {
      targetType: 'organization',
      targetId: org.id,
      targetName: label,
      antenne_id: org.antenne_id,
      delegation_id: org.delegation_id,
      details: `Compte « ${label} » supprimé`,
    });
    if (localDb.isSandboxActive()) {
      localDb.deleteOrganization(org.id);
      setOrgProfiles(localDb.getOrganizations());
      logIt();
      toast(`Compte « ${label} » supprimé.`, 'success');
      return;
    }
    try {
      await deleteDoc(doc(db, 'organizations', org.id));
      logIt();
      toast(`Compte « ${label} » supprimé.`, 'success');
    } catch (err: any) {
      console.error("Error deleting organization:", err);
      toast("Échec de la suppression : " + (err?.message || 'erreur inconnue'), 'error');
    }
  };

  const handleSaveOrgDelegationAntenne = async (orgId: string) => {
    if (!editDelegation || !editAntenne) return;
    const known = orgProfiles.find(o => o.id === orgId);
    const antName = (ANTENNES_BY_DELEGATION[editDelegation] || []).find(a => a.id === editAntenne)?.name || editAntenne;
    const logIt = () => logAction('org_assign_antenne', {
      targetType: 'organization',
      targetId: orgId,
      targetName: known?.name || orgId,
      antenne_id: editAntenne,
      delegation_id: editDelegation,
      details: `Antenne de rattachement : ${antName}`,
    });
    if (localDb.isSandboxActive()) {
      const orgs = localDb.getOrganizations();
      const target = orgs.find(o => o.id === orgId);
      if (target) {
        target.delegation_id = editDelegation;
        target.antenne_id = editAntenne;
        target.updatedAt = Date.now();
        localDb.saveOrganization(target);
      }
      setOrgProfiles(localDb.getOrganizations());
      logIt();
      setEditingOrgId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        delegation_id: editDelegation,
        antenne_id: editAntenne,
        updatedAt: Date.now()
      });
      logIt();
      setEditingOrgId(null);
    } catch (err) {
      console.error("Error saving delegation assignment:", err);
    }
  };

  // When switcher / delegation context changes, auto-load first city tab under her responsibility
  useEffect(() => {
    if (delegationFilterId) {
      const townList = ANTENNES_BY_DELEGATION[delegationFilterId] || [];
      if (townList.length > 0) {
        setActiveAntenneId(townList[0].id);
      } else {
        setActiveAntenneId(null);
      }
    } else {
      setActiveAntenneId(null);
    }
    setCurrentFolderId(null);
  }, [delegationFilterId]);

  // When active city changes, close active folder representing the open organism
  useEffect(() => {
    setCurrentFolderId(null);
  }, [activeAntenneId]);

  // Real-time Firestore sync
  useEffect(() => {
    let unsubFiles = () => {};
    let unsubFolders = () => {};
    let unsubOrgs = () => {};

    const loadLocalData = () => {
      setFiles(localDb.getFiles());
      setFolders(localDb.getFolders());
      setOrgProfiles(localDb.getOrganizations());
    };

    // Ne bascule en sauvegarde locale QUE si Firestore est réellement injoignable
    // (connexion perdue / quota). Une simple erreur de permission ne doit pas
    // faire basculer toute l'admin en local (évite le bandeau orange à tort).
    const maybeFallback = (err: any) => {
      const code = err?.code || '';
      const msg = (err?.message || String(err)).toLowerCase();
      const isConnectivity =
        code === 'unavailable' ||
        code === 'deadline-exceeded' ||
        msg.includes('offline') ||
        msg.includes('network') ||
        msg.includes('quota') ||
        msg.includes('limit exceeded');
      if (isConnectivity) {
        console.warn('Firestore injoignable (AdminPanel). Bascule en sauvegarde locale :', err);
        localDb.setSandboxActive(true);
        loadLocalData();
      } else {
        console.warn('Erreur Firestore (non bloquante) dans AdminPanel, pas de bascule locale :', err);
      }
    };

    if (localDb.isSandboxActive()) {
      loadLocalData();
      
      const handleLocalDbUpdate = () => {
        loadLocalData();
      };
      
      window.addEventListener('localdb-update', handleLocalDbUpdate);
      return () => {
        window.removeEventListener('localdb-update', handleLocalDbUpdate);
      };
    } else {
      // Le panneau d'administration est réservé au siège (super admin / admin
      // national), qui lit l'ensemble des données.
      const scopeDelegation: string | null = null;
      const scoped = (col: string) =>
        scopeDelegation
          ? query(collection(db, col), where('delegation_id', '==', scopeDelegation))
          : query(collection(db, col));

      try {
        const qFiles = scoped('files');
        unsubFiles = onSnapshot(qFiles, (snapshot) => {
          const filesData: DossierFile[] = [];
          snapshot.forEach((doc) => {
            filesData.push({ id: doc.id, ...doc.data() } as DossierFile);
          });
          setFiles(filesData);
        }, maybeFallback);
      } catch (err) {
        maybeFallback(err);
      }

      try {
        const qFolders = scoped('folders');
        unsubFolders = onSnapshot(qFolders, (snapshot) => {
          const foldersData: Folder[] = [];
          snapshot.forEach((doc) => {
            foldersData.push({ id: doc.id, ...doc.data() } as Folder);
          });
          setFolders(foldersData);
        }, maybeFallback);
      } catch (err) {
        maybeFallback(err);
      }

      try {
        const qOrgs = scoped('organizations');
        unsubOrgs = onSnapshot(qOrgs, (snapshot) => {
          const orgsData: Organization[] = [];
          snapshot.forEach((doc) => {
            orgsData.push({ id: doc.id, ...doc.data() } as Organization);
          });
          setOrgProfiles(orgsData);
        }, maybeFallback);
      } catch (err) {
        maybeFallback(err);
      }
    }

    return () => {
      unsubFiles();
      unsubFolders();
      unsubOrgs();
    };
  }, []);

  // Handle uploading document within designated partner/organism dossier
  const onUploadFiles = async (selectedFiles: File[]) => {
    if (!delegationFilterId || !activeAntenneId || !currentFolderId) {
      toast("Veuillez d'abord ouvrir un dossier d'organisme.", 'warning');
      return;
    }
    setUploading(true);
    setUploadProgress(0);

    // Journalise un dépôt réellement enregistré (rattaché à l'antenne ciblée).
    const logUpload = (f: File) => logAction('file_upload', {
      targetType: 'file',
      targetName: f.name,
      antenne_id: activeAntenneId || undefined,
      delegation_id: delegationFilterId || undefined,
      details: 'Dépôt par un coordinateur',
    });

    for (const f of selectedFiles) {
      if (localDb.isSandboxActive()) {
        try {
          const dataUrl = await readFileAsDataUrl(f);
          const mockFile: DossierFile = {
            id: `mock_file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            orgId: currentFolder?.orgId || 'public',
            folderId: currentFolderId,
            delegation_id: delegationFilterId || 'france',
            antenne_id: activeAntenneId || '',
            name: f.name,
            size: f.size,
            type: f.type || 'application/octet-stream',
            storagePath: 'sandbox',
            fallbackDataUrl: dataUrl,
            uploadDate: Date.now(),
            uploadedBy: 'admin',
            submissionStatus: 'Pending'
          };
          localDb.saveFile(mockFile);
          logUpload(f);
        } catch (e) {
          console.error('Lecture fichier (sandbox) échec:', e);
          toast(`Lecture impossible pour ${f.name}.`, 'error');
        }
        continue;
      }

      const storagePath = `delegations/${delegationFilterId}/${activeAntenneId}/${Date.now()}_${f.name}`;
      const storageRef = ref(storage, storagePath);
      
      try {
        const uploadTask = uploadBytesResumable(storageRef, f);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                
                await addDoc(collection(db, 'files'), {
                  orgId: currentFolder?.orgId || 'public', // Inherit folder's owner ID
                  folderId: currentFolderId,
                  delegation_id: delegationFilterId,
                  antenne_id: activeAntenneId,
                  name: f.name,
                  size: f.size,
                  type: f.type || 'application/octet-stream',
                  storagePath: storagePath,
                  fallbackDataUrl: downloadUrl,
                  uploadDate: Date.now(),
                  uploadedBy: 'admin',
                  submissionStatus: 'Pending'
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
        logUpload(f);
      } catch (err: any) {
        console.error("Upload error:", err);
        // Fallback Base64 for sandbox compatibility if Storage blocks
        try {
          const fallbackUrl = await readFileAsDataUrl(f);

          await addDoc(collection(db, 'files'), {
            orgId: currentFolder?.orgId || 'public',
            folderId: currentFolderId,
            delegation_id: delegationFilterId,
            antenne_id: activeAntenneId,
            name: f.name,
            size: f.size,
            type: f.type || 'application/octet-stream',
            storagePath: 'firestore_fallback',
            fallbackDataUrl: fallbackUrl,
            uploadDate: Date.now(),
            uploadedBy: 'admin',
            submissionStatus: 'Pending'
          });
          logUpload(f);
        } catch (baseErr) {
          toast(`Erreur de secours pour ${f.name} : ${baseErr}`, 'error');
        }
      }
    }
    if (localDb.isSandboxActive()) {
      setFiles(localDb.getFiles());
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // Create subfolder representing a Partner Organization ("Dossier Organisme")
  const handleCreateFolder = async (name: string) => {
    if (!delegationFilterId || !activeAntenneId) return;
    if (localDb.isSandboxActive()) {
      const mockFolder: Folder = {
        id: `mock_folder_${Date.now()}`,
        orgId: 'admin_created',
        name: name.trim(),
        delegation_id: delegationFilterId,
        antenne_id: activeAntenneId,
        createdAt: Date.now(),
        createdBy: 'admin'
      };
      localDb.saveFolder(mockFolder);
      setFolders(localDb.getFolders());
      logAction('folder_create', { targetType: 'folder', targetName: name.trim(), antenne_id: activeAntenneId, delegation_id: delegationFilterId });
      return;
    }
    try {
      await addDoc(collection(db, 'folders'), {
        orgId: 'admin_created',
        name: name.trim(),
        delegation_id: delegationFilterId,
        antenne_id: activeAntenneId,
        createdAt: Date.now(),
        createdBy: 'admin'
      });
      logAction('folder_create', { targetType: 'folder', targetName: name.trim(), antenne_id: activeAntenneId, delegation_id: delegationFilterId });
    } catch (err) {
      console.error("Error creating folder:", err);
    }
  };

  // File and Folder modifications
  const handleUpdateStatus = async (fileId: string, newStatus: SubmissionStatus) => {
    const known = files.find(f => f.id === fileId);
    const logIt = () => logAction('file_status_change', {
      targetType: 'file',
      targetId: fileId,
      targetName: known?.name || fileId,
      antenne_id: known?.antenne_id,
      delegation_id: known?.delegation_id,
      details: `Statut du document : ${newStatus}`,
    });
    if (localDb.isSandboxActive()) {
      const filesList = localDb.getFiles();
      const target = filesList.find(f => f.id === fileId);
      if (target) {
        target.submissionStatus = newStatus;
        localDb.saveFile(target);
      }
      setFiles(localDb.getFiles());
      logIt();
      return;
    }
    try {
      await updateDoc(doc(db, 'files', fileId), {
        submissionStatus: newStatus
      });
      logIt();
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleConfirmGeneralRename = async () => {
    if (!renamingFile || !renameInput.trim() || renameInput.trim() === renamingFile.name) {
      setRenamingFile(null);
      return;
    }
    const newName = renameInput.trim();
    const logIt = () => logAction('file_rename', {
      targetType: 'file',
      targetId: renamingFile.id,
      targetName: newName,
      antenne_id: renamingFile.antenne_id,
      delegation_id: renamingFile.delegation_id,
      details: `Renommé : « ${renamingFile.name} » → « ${newName} »`,
    });
    if (localDb.isSandboxActive()) {
      const filesList = localDb.getFiles();
      const target = filesList.find(f => f.id === renamingFile.id);
      if (target) {
        target.name = newName;
        localDb.saveFile(target);
      }
      setFiles(localDb.getFiles());
      logIt();
      setRenamingFile(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'files', renamingFile.id), {
        name: newName
      });
      logIt();
      setRenamingFile(null);
    } catch (err) {
      console.error("Error renaming file:", err);
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    const logIt = () => logAction('file_delete', {
      targetType: 'file',
      targetId: fileToDelete.id,
      targetName: fileToDelete.name,
      antenne_id: fileToDelete.antenne_id,
      delegation_id: fileToDelete.delegation_id,
    });
    if (localDb.isSandboxActive()) {
      localDb.deleteFile(fileToDelete.id);
      setFiles(localDb.getFiles());
      logIt();
      setFileToDelete(null);
      return;
    }
    try {
      // Nettoyage du stockage associé (chunks Firestore ou objet Storage natif).
      await deleteFileArtifacts(fileToDelete);
      await deleteDoc(doc(db, 'files', fileToDelete.id));
      logIt();
      toast('Fichier supprimé.', 'success');
      setFileToDelete(null);
    } catch (err: any) {
      console.error("Error deleting document:", err);
      toast("Échec de la suppression : " + (err?.message || 'erreur'), 'error');
    }
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    const logIt = () => logAction('folder_delete', {
      targetType: 'folder',
      targetId: folderToDelete.id,
      targetName: folderToDelete.name,
      antenne_id: folderToDelete.antenne_id,
      delegation_id: folderToDelete.delegation_id,
    });
    if (localDb.isSandboxActive()) {
      localDb.deleteFolder(folderToDelete.id);
      setFiles(localDb.getFiles());
      setFolders(localDb.getFolders());
      logIt();
      setFolderToDelete(null);
      setCurrentFolderId(null);
      return;
    }
    try {
      // 1. Delete all files linked to this folder to maintain hygiene
      const relatedFiles = files.filter(f => f.folderId === folderToDelete.id);
      for (const f of relatedFiles) {
        await deleteDoc(doc(db, 'files', f.id));
      }
      // 2. Delete folder metadata
      await deleteDoc(doc(db, 'folders', folderToDelete.id));
      logIt();
      setFolderToDelete(null);
      setCurrentFolderId(null);
    } catch (err) {
      console.error("Error deleting folder:", err);
    }
  };

  // Statistics calculation helpers
  const getDelegationStats = (delId: string) => {
    const delFiles = files.filter(f => f.delegation_id === delId);
    const delFolders = folders.filter(f => f.delegation_id === delId);
    
    return {
      filesCount: delFiles.length,
      foldersCount: delFolders.length,
      pendingCount: delFiles.filter(f => f.submissionStatus === 'Pending' || !f.submissionStatus).length,
      validatedCount: delFiles.filter(f => f.submissionStatus === 'Validated').length,
    };
  };

  // Filter content in workspace
  const filteredFolders = folders.filter(fol => {
    const matchesDelegation = fol.delegation_id === delegationFilterId;
    const matchesAntenne = fol.antenne_id === activeAntenneId;
    const matchesSearch = fol.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDelegation && matchesAntenne && matchesSearch;
  });

  const filteredFiles = files.filter(f => {
    if (currentFolderId === UNFILED_FOLDER_ID) {
      // Fichiers de l'antenne courante non rangés dans un dossier.
      if (f.folderId) return false;
      if (f.antenne_id !== activeAntenneId) return false;
    } else if (f.folderId !== currentFolderId) {
      return false;
    }
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesType = true;
    if (fileTypeFilter === 'pdfs') {
      matchesType = f.type === 'application/pdf' || f.name.endsWith('.pdf');
    } else if (fileTypeFilter === 'images') {
      matchesType = f.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(f.name);
    }
    const matchesStatus = fileStatusFilter === 'all' || (f.submissionStatus || 'Pending') === fileStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    return b.uploadDate - a.uploadDate; // default date desc
  });

  const selectedDelegationData = DELEGATIONS.find(d => d.id === delegationFilterId);
  const selectedAntennes = activeAntenneId && ANTENNES_BY_DELEGATION[delegationFilterId || '']
    ? ANTENNES_BY_DELEGATION[delegationFilterId || ''].find(a => a.id === activeAntenneId)
    : null;

  // Fichiers de l'antenne active déposés hors dossier (par un partenaire).
  const unfiledFiles = activeAntenneId
    ? files.filter(f => !f.folderId && f.antenne_id === activeAntenneId)
    : [];

  const currentFolder =
    currentFolderId === UNFILED_FOLDER_ID
      ? ({ id: UNFILED_FOLDER_ID, name: 'Documents non classés', orgId: 'public' } as any)
      : folders.find(fd => fd.id === currentFolderId);

  // Compteurs d'éléments en attente de validation, affichés en badge sur les cards du hub.
  const pendingFilesCount = files.filter(f => f.submissionStatus === 'Pending').length;
  const pendingOrgsCount = orgProfiles.filter(o => o.submissionStatus === 'Pending').length;

  // Liste plate de toutes les antennes (toutes délégations) pour la gestion des groupes.
  const allAntennesFlat: { id: string; name: string }[] = Object.values(ANTENNES_BY_DELEGATION)
    .flat()
    .map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }));

  // --- Tableau de bord chiffré (hub) ---
  // Conformité par antenne : documents validés / total, trié par volume.
  const antenneStats = useMemo(() => {
    const nameOf = (id: string) => allAntennesFlat.find((a) => a.id === id)?.name || id || '—';
    const map = new Map<string, { total: number; validated: number }>();
    for (const f of files) {
      const id = f.antenne_id || '—';
      const e = map.get(id) || { total: 0, validated: 0 };
      e.total++;
      if ((f.submissionStatus || 'Pending') === 'Validated') e.validated++;
      map.set(id, e);
    }
    return Array.from(map.entries())
      .map(([id, s]) => ({ id, name: nameOf(id), ...s }))
      .sort((a, b) => b.total - a.total);
  }, [files, allAntennesFlat]);

  // Activité récente : 6 dernières entrées du journal (super admin uniquement).
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  useEffect(() => {
    if (!isSuperAdminMode) return;
    const unsub = subscribeAuditLogs({}, (l) => setRecentLogs(l.slice(0, 6)), 6);
    return unsub;
  }, [isSuperAdminMode]);

  // Raccourci clavier ⌘K / Ctrl+K : focus la première barre de recherche visible.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.querySelector('[data-admin-search]') as HTMLInputElement | null;
        if (el) el.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Conformité globale (tous documents) pour l'anneau du hub.
  const globalValidated = files.filter((f) => (f.submissionStatus || 'Pending') === 'Validated').length;

  // Visite guidée contextuelle : les étapes s'adaptent à la page affichée.
  const tourIntro: TourStep = { target: '[data-tour="tutoriel"]', title: 'Le bouton Tutoriel', text: "Toujours ici, en haut à droite. Il s'adapte à la page affichée : relancez-le sur chaque espace pour en découvrir les options." };
  const buildTour = (): TourStep[] => {
    if (navigationView === 'logs') {
      return [tourIntro, { target: '[data-tour="admin-journal"]', title: "Journal d'activité national", text: "L'historique précis de toutes les actions de tous les comptes. Filtrez par catégorie pour enquêter." }];
    }
    if (navigationView === 'ailes' && isSuperAdminMode && !activeDelegationId) {
      return [tourIntro, { target: '[data-tour="admin-ailes"]', title: 'Les délégations nationales', text: "Vue d'ensemble des délégations. Cliquez sur l'une d'elles pour entrer dans son espace de travail dédié." }];
    }
    if (navigationView !== 'hub' && activeDelegationId) {
      return [
        tourIntro,
        { target: '[data-tour="admin-detail"]', title: "L'espace de la délégation", text: "Gérez ici les documents, les membres et les implantations de la délégation sélectionnée." },
        { target: '[data-admin-search]', title: 'Recherche et filtres', text: "Retrouvez un document (raccourci ⌘K / Ctrl+K) et filtrez par type ou par statut." },
      ];
    }
    return [
      tourIntro,
      { target: '[data-tour="kpi"]', title: 'Vos indicateurs', text: "Documents et organismes en attente, justificatifs et organismes rattachés : l'essentiel en un coup d'œil." },
      { target: '[data-tour="conformity"]', title: 'Conformité par antenne', text: "Le taux de conformité global (anneau) et le détail par antenne, pour repérer les dossiers à relancer." },
      { target: '[data-tour="nav"]', title: 'Vos espaces de travail', text: "Accédez aux Ailes du Sourire, aux membres, aux implantations et au journal d'activité." },
    ];
  };
  const startTour = () => setActiveTour(buildTour());

  return (
    <div className={`min-h-screen flex flex-col ${themeConfig.bg} ${themeConfig.fontFamily} transition-colors duration-300`}>
      
      {localDb.isSandboxActive() && (
        <div className="bg-amber-500 text-white text-xs px-6 py-2.5 flex items-center justify-between gap-4 font-bold tracking-wide shadow-sm text-center select-none z-50 shrink-0">
          <div className="flex items-center gap-2 mx-auto justify-center">
            <span className="text-base">💡</span>
            <span>Mode Bac à sable activé : Le quota d'écriture journalier de Google Firestore étant dépassé, vos modifications de dossiers et actions d'antennes sont de retour en mémoire locale !</span>
          </div>
          <button 
            onClick={() => {
              localDb.setSandboxActive(false);
              window.location.reload();
            }}
            className="text-[10px] bg-white/20 hover:bg-white/30 text-white border border-white/40 px-2.5 py-1 rounded transition-all shrink-0 uppercase font-black cursor-pointer"
          >
            Réessayer Firebase
          </button>
        </div>
      )}

      {/* 2. Main Platform Header */}
      <header className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <LogoASF className="w-10 h-10 shrink-0" variant="color" />
          <div>
            <h1 className="text-md font-bold text-deep dark:text-white leading-tight font-display flex items-center gap-1.5">
              <span>{isSuperAdminMode ? 'Portail de Coordination Nationale' : 'Portail de Coordination Régionale'}</span>
              <span className="text-[10px] bg-azur-light text-azur border border-azur/15 font-mono tracking-wider uppercase px-1.5 py-0.5 rounded font-black">{isSuperAdminMode ? 'Admin' : 'Coordinateur'}</span>
            </h1>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-400">
              {isSuperAdminMode
                ? 'Aviation Sans Frontières France — Pilotage des délégations et autorisations de vol.'
                : `Aviation Sans Frontières — Coordination de ${selectedDelegationData?.name || 'votre délégation'}.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {organization?.contactName || "Administrateur National"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
              {isSuperAdminMode ? "Direction Siège Paris" : `Coordinateur Régional - ${selectedDelegationData?.name}`}
            </span>
          </div>

          <button
            onClick={startTour}
            data-tour="tutoriel"
            className="btn-sourire text-sm shrink-0"
            title="Visite guidée du portail"
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">Tutoriel</span>
          </button>

          <button
            onClick={signOut}
            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-100 transition-colors cursor-pointer shrink-0"
            title="Se déconnecter de la session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>



      {/* 3. Main Operational Content */}
      <main className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* --- PORTAL HUB VIEW --- */}
        {navigationView === 'hub' && (
          <div className="max-w-5xl mx-auto space-y-8 py-6">
            {/* Welcome header */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-azur font-bold">{isSuperAdminMode ? 'Cabinet de pilotage national' : 'Cabinet de coordination régionale'}</p>
              <h2 className="text-2xl sm:text-3xl font-black font-display text-deep dark:text-white tracking-tight">
                Bonjour {organization?.contactName?.split(' ')[0] || 'Administrateur'} 👋
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl font-medium">
                Coordination et contrôle de conformité aéronautique d'Aviation Sans Frontières.
              </p>
            </div>

            {/* KPI strip */}
            <div data-tour="kpi" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Documents en attente', value: pendingFilesCount, tone: 'text-amber-600 bg-amber-50', accent: pendingFilesCount > 0 },
                { label: 'Organismes en attente', value: pendingOrgsCount, tone: 'text-orange-600 bg-orange-50', accent: pendingOrgsCount > 0 },
                { label: 'Justificatifs', value: files.length, tone: 'text-azur bg-azur/10', accent: false },
                { label: 'Organismes rattachés', value: folders.length, tone: 'text-deep bg-azur-light', accent: false },
              ].map((k) => (
                <div key={k.label} className={`card-asf p-4 ${k.accent ? 'ring-1 ring-amber-200' : ''}`}>
                  <p className="font-display text-3xl font-extrabold text-deep dark:text-white">{k.value}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Tableau de bord chiffré : conformité par antenne + activité récente */}
            <div data-tour="conformity" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conformité par antenne */}
              <div className="card-asf p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <ComplianceRing validated={globalValidated} total={files.length} size={48} />
                    <div>
                      <h3 className="font-display text-deep dark:text-white font-bold tracking-tight text-sm">Conformité par antenne</h3>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">conformité globale</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">validés / total</span>
                </div>
                {antenneStats.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Aucun document pour le moment.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {antenneStats.slice(0, 8).map((a) => (
                      <div key={a.id}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{a.name}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">{a.total} doc{a.total > 1 ? 's' : ''}</span>
                        </div>
                        <ComplianceBar validated={a.validated} total={a.total} showLabel={false} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activité récente */}
              <div className="card-asf p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-deep dark:text-white font-bold tracking-tight text-sm">Activité récente</h3>
                  <button
                    onClick={() => { setNavigationView('logs'); setCurrentFolderId(null); }}
                    className="text-[11px] font-bold text-azur hover:underline inline-flex items-center gap-1"
                  >
                    Tout voir <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {recentLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Aucune activité récente.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentLogs.map((log) => (
                      <div key={log.id} className="py-2.5 flex items-start gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-azur mt-1.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-700 dark:text-slate-200 truncate">
                            <span className="font-bold">{log.actorName}</span>
                            {' — '}
                            <span className="text-slate-500">{log.details || log.action}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(log.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            {log.targetName ? ` · ${log.targetName}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section title */}
            <div className="flex items-center gap-2 pt-1">
              <h3 className="font-display text-deep dark:text-white font-bold tracking-tight">Espaces de travail</h3>
              <span className="flex-1 h-px bg-slate-200/70 dark:bg-slate-800" />
            </div>

            {/* Hub Cards Grid */}
            <div data-tour="nav" className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Card 1: Ailes du Sourire */}
              <button
                onClick={() => {
                  setNavigationView('ailes');
                  setActiveTab('workspaces');
                  setCurrentFolderId(null);
                }}
                className="group bg-white dark:bg-slate-900 border border-slate-200/85 hover:border-azur rounded-3xl p-6 text-left shadow-xs hover:shadow-lg transition-all flex flex-col justify-between h-72 cursor-pointer relative overflow-hidden"
              >
                {pendingFilesCount > 0 && (
                  <span
                    className="absolute top-3 right-3 z-10 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold shadow-md"
                    title={`${pendingFilesCount} fichier(s) en attente de validation`}
                    aria-label={`${pendingFilesCount} fichiers en attente de validation`}
                  >
                    {pendingFilesCount}
                  </span>
                )}
                <div className="absolute top-0 right-0 w-36 h-36 bg-azur/5 rounded-full blur-2xl pointer-events-none group-hover:bg-azur/10 transition-all"></div>
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-azur/10 text-azur flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    ✈️
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-deep dark:text-white tracking-tight group-hover:text-azur transition-colors flex items-center gap-1.5">
                      <span>Programme Ailes du Sourire</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Supervisez les antennes de vol, les justificatifs réglementaires de navigabilité et accédez aux dossiers d'organismes.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-azur uppercase tracking-wider group-hover:translate-x-1 transition-transform mt-4">
                  <span>Accéder à la supervision</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {/* Card 2: Users Management */}
              <button
                onClick={() => {
                  setNavigationView('users');
                  setActiveTab('members');
                  setCurrentFolderId(null);
                }}
                className="group bg-white dark:bg-slate-900 border border-slate-200/85 hover:border-orange-500 rounded-3xl p-6 text-left shadow-xs hover:shadow-lg transition-all flex flex-col justify-between h-72 cursor-pointer relative overflow-hidden"
              >
                {pendingOrgsCount > 0 && (
                  <span
                    className="absolute top-3 right-3 z-10 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold shadow-md"
                    title={`${pendingOrgsCount} organisation(s) en attente de validation`}
                    aria-label={`${pendingOrgsCount} organisations en attente de validation`}
                  >
                    {pendingOrgsCount}
                  </span>
                )}
                <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-orange-500/10 transition-all"></div>
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    👥
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-deep dark:text-white tracking-tight group-hover:text-orange-500 transition-colors flex items-center gap-1.5">
                      <span>Gestion des Utilisateurs</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Gerez les habilitations, les permissions des structures affiliees, et attribuez les accreditations de coordinateurs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-orange-500 uppercase tracking-wider group-hover:translate-x-1 transition-transform mt-4">
                  <span>Gérer les accès</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {/* Card 3: Implantations / Stations (super admin only) */}
              {isSuperAdminMode && (
              <button
                onClick={() => {
                  setNavigationView('implantations');
                  setActiveTab('delegations');
                  setCurrentFolderId(null);
                }}
                className="group bg-white dark:bg-slate-900 border border-slate-200/85 hover:border-amber-500 rounded-3xl p-6 text-left shadow-xs hover:shadow-lg transition-all flex flex-col justify-between h-72 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    📍
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-deep dark:text-white tracking-tight group-hover:text-amber-500 transition-colors flex items-center gap-1.5">
                      <span>Gestion des Implantations</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Cartographiez les antennes nationales d'initiations sur la carte interactive de France et configurez de nouveaux relais.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-500 uppercase tracking-wider group-hover:translate-x-1 transition-transform mt-4">
                  <span>Configurer l'implantation</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
              )}

              {/* Card 4: Journal d'activité (super admin : tous les logs ;
                  coordinateur : les logs de sa délégation). */}
              <button
                onClick={() => {
                  setNavigationView('logs');
                  setCurrentFolderId(null);
                }}
                className="group bg-white dark:bg-slate-900 border border-slate-200/85 hover:border-azur rounded-3xl p-6 text-left shadow-xs hover:shadow-lg transition-all flex flex-col justify-between h-72 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-36 h-36 bg-azur/5 rounded-full blur-2xl pointer-events-none group-hover:bg-azur/10 transition-all"></div>
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-azur/10 text-azur flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    📜
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-deep dark:text-white tracking-tight group-hover:text-azur transition-colors flex items-center gap-1.5">
                      <span>Journal d'activité</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Consultez l'historique horodaté de toutes les actions : connexions, dépôts et suppressions de fichiers, changements de statut, de rôle et de comptes.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-azur uppercase tracking-wider group-hover:translate-x-1 transition-transform mt-4">
                  <span>Consulter les logs</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

            </div>

            {/* Quick overview metric line */}
            <div className="bg-slate-50 dark:bg-slate-950/40 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-slate-500 dark:text-slate-400">Toutes les bases de données sont connectées et synchronisées en temps réel.</span>
              </div>
              <div className="text-slate-400 dark:text-slate-500 font-mono">
                {files.length} Justificatifs • {folders.length} Organismes rattachés
              </div>
            </div>
          </div>
        )}

        {/* --- JOURNAL D'ACTIVITÉ (super admin : tous les logs) --- */}
        {navigationView === 'logs' && (
          <div data-tour="admin-journal" className="space-y-5">
            <button
              onClick={() => setNavigationView('hub')}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-azur transition-colors"
            >
              <CornerLeftUp className="w-4 h-4" />
              <span>Retour au tableau de bord</span>
            </button>
            <AuditLogPanel
              title="Journal d'activité — Vue nationale"
              subtitle="Toutes les actions de tous les comptes (super admin, gestionnaires d'antenne, partenaires)."
            />
          </div>
        )}

        {/* --- SCENARIO A: PARIS SUPER ADMIN GLOBAL HQ OVERVIEW --- */}
        {navigationView === 'ailes' && isSuperAdminMode && !activeDelegationId && (
          <div data-tour="admin-ailes" className="space-y-6">
            {/* National Supervisor Card */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="absolute top-0 right-0 w-96 h-96 bg-azur/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="space-y-2 relative z-10">
                <span className="text-azur text-[10px] tracking-widest font-mono uppercase font-black">
                  DIRECTION PARIS SÉCURITÉ & LOGISTIQUE
                </span>
                <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight leading-tight">
                  Supervision des 4 Délégations Nationales
                </h2>
                <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
                  Consultez en temps réel les dossiers de vol, les justificatifs de navigabilité, et pilotez les dossiers des antennes locales d'Aviation Sans Frontières. Cliquez sur une délégation ci-dessous pour entrer dans son espace de travail dédié.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 shrink-0 text-left min-w-[220px] relative z-10">
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Total des Fichiers Nationaux</p>
                <p className="text-3xl font-black font-display tracking-tight mt-1 text-azur">{files.length}</p>
                <div className="flex gap-2.5 mt-2.5 text-[10.5px]">
                  <span className="text-slate-400">
                    📂 <strong className="text-white">{folders.length}</strong> dossiers
                  </span>
                  <span className="text-slate-400">
                    🕒 <strong className="text-amber-400">{files.filter(f => f.submissionStatus === 'Pending' || !f.submissionStatus).length}</strong> en attente
                  </span>
                </div>
              </div>
            </div>

            {/* The 4 Delegations Grid selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {DELEGATIONS.map((del) => {
                const stats = getDelegationStats(del.id);
                return (
                  <button
                    key={del.id}
                    onClick={() => setActiveDelegationId(del.id)}
                    className="group bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 hover:border-azur shadow-xs hover:shadow-lg transition-all text-left flex flex-col justify-between h-56 cursor-pointer relative"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-xl bg-azur-light text-azur flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                          <Layers className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold bg-slate-50 border px-2 py-0.5 rounded">
                          Région : {del.id.toUpperCase()}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-deep dark:text-white font-sans tracking-tight group-hover:text-azur transition-colors">
                        {del.name}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-400 mt-1 lines-clamp-2 leading-relaxed">
                        {del.desc}
                      </p>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-4 flex justify-between items-center w-full">
                      <div className="flex gap-4 text-[11px] text-slate-500">
                        <span>📂 <strong>{stats.foldersCount}</strong> Villes/Organismes</span>
                        <span>📄 <strong>{stats.filesCount}</strong> Justificatifs</span>
                      </div>

                      {stats.pendingCount > 0 ? (
                        <span className="text-[10px] bg-amber-500/10 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          🕒 {stats.pendingCount} à vérifier
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          ✓ À jour
                        </span>
                      )}
                    </div>

                    <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --- SCENARIO B: ACTIVE DELEGATION WORKSPACE --- */}
        {navigationView !== 'hub' && navigationView !== 'logs' && activeDelegationId && (() => {
          const themeAttr = DELEGATION_THEMES[delegationFilterId] || DELEGATION_THEMES['ouest'];
          return (
            <div data-tour="admin-detail" className="space-y-6">

              {/* Back breadcrumb navigation to Admin Hub */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                <nav className="flex items-center gap-2.5 flex-wrap" aria-label="Fil d'ariane">
                  <button
                    onClick={() => {
                      setNavigationView('hub');
                      setCurrentFolderId(null);
                    }}
                    className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${themeAttr.badgeClass} hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs`}
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" /> <span>Retour au Hub</span>
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  <span className="text-xs font-bold text-deep dark:text-white font-display tracking-tight">
                    {navigationView === 'ailes' ? 'Ailes du Sourire' : navigationView === 'users' ? 'Membres' : 'Implantations'}
                  </span>
                </nav>

                <div className="text-[10px] uppercase font-mono font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-azur animate-pulse"></span>
                  <span>Portail Admin • {navigationView === 'ailes' ? 'Ailes du Sourire' : navigationView === 'users' ? 'Utilisateurs' : 'Implantations'}</span>
                </div>
              </div>

              {/* Delegation Header Details Banner (Only for Program Ailes du Sourire) */}
              {navigationView === 'ailes' && (
                <div className={`bg-gradient-to-r ${themeAttr.gradientClass} border ${themeAttr.bannerBorder} rounded-3xl p-6 shadow-xs relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
                  <div className={`absolute top-0 right-0 w-80 h-80 ${themeAttr.bgDecorative} rounded-full blur-3xl pointer-events-none`}></div>
                  
                  <div className="flex items-start gap-4 md:gap-5 relative z-10 w-full md:w-auto">
                    <div className={`w-14 h-14 ${themeAttr.colorClass} rounded-2xl flex items-center justify-center shrink-0 border border-current/10 shadow-xs transform hover:rotate-3 transition-all duration-350`}>
                      <LogoASF className="w-9 h-9" variant="color" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9.5px] tracking-widest font-black uppercase px-2.5 py-1 rounded-lg border leading-none ${themeAttr.badgeClass}`}>
                          Espace de travail régional
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                          REG-ID : {delegationFilterId.toUpperCase()}
                        </span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white font-sans mt-2">
                        {selectedDelegationData?.name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed font-semibold">
                        {selectedDelegationData?.desc}. Créez des dossiers pour chaque organisme avec qui on collabore sous chaque ville de votre responsabilité.
                      </p>
                    </div>
                  </div>

                  {/* Mini Stats widget */}
                  <div className="flex flex-wrap gap-3 items-center shrink-0 relative z-10 w-full md:w-auto">
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-azur/15 px-5 py-3 rounded-2xl text-left min-w-[130px] shadow-xs flex-1 md:flex-none transition-all hover:bg-white dark:hover:bg-slate-900 border-slate-200/80 dark:border-slate-800">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider font-extrabold text-xs">Antennes</p>
                      <p className="text-lg font-black text-slate-950 dark:text-white mt-1 leading-none">
                        {(ANTENNES_BY_DELEGATION[delegationFilterId] || []).length}
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 px-5 py-3 rounded-2xl text-left min-w-[130px] shadow-xs flex-1 md:flex-none transition-all hover:bg-white dark:hover:bg-slate-900">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider font-extrabold text-xs">Organismes</p>
                      <p className={`text-lg font-black mt-1 leading-none ${themeAttr.accentText}`}>
                        {folders.filter(fol => fol.delegation_id === delegationFilterId).length}
                      </p>
                      <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block">Cabinets actifs</span>
                    </div>
                    
                    <button
                      onClick={handleExportComplianceReport}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 px-4 py-4 rounded-2xl transition-all shadow-xs cursor-pointer w-full md:w-auto justify-center"
                      title="Télécharger le rapport de conformité de la délégation"
                    >
                      <Download className="w-4 h-4 text-azur" />
                      <span>Exporter (CSV)</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'workspaces' && (
              <div className="space-y-6">
                {/* Tableau de bord Ailes du Sourire */}
                <AilesDuSourireDashboard
                  files={files}
                  folders={folders}
                  orgProfiles={orgProfiles}
                  activeAntenneId={activeAntenneId}
                  setActiveAntenneId={setActiveAntenneId}
                  antennes={ANTENNES_BY_DELEGATION}
                  delegationFilterId={delegationFilterId}
                  onUpdateFileStatus={handleUpdateStatus}
                  themeAttr={DELEGATION_THEMES[delegationFilterId] || DELEGATION_THEMES['france'] || DELEGATION_THEMES['ouest']}
                />

                {/* 4. CHOOSE TOWN (Onglets de Villes / Antennes locaux) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Sélectionner l'antenne régionale (villes actives)</span>
                  </div>
              
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {(ANTENNES_BY_DELEGATION[delegationFilterId] || []).length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic p-4 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 w-full text-center">
                        Aucune antenne n'est active actuellement. Allez dans l'onglet "Gestion des Implantations" pour en placer une sur la carte.
                      </div>
                    ) : (
                      (ANTENNES_BY_DELEGATION[delegationFilterId] || []).map((ant) => {
                        const active = activeAntenneId === ant.id;
                        const countFolders = folders.filter(fol => fol.antenne_id === ant.id).length;
                        const antPending = files.filter(f => f.antenne_id === ant.id && (f.submissionStatus === 'Pending' || !f.submissionStatus)).length;
                        
                        return (
                          <button
                            key={ant.id}
                            onClick={() => setActiveAntenneId(ant.id)}
                            className={`px-5 py-3 rounded-2xl text-xs font-bold tracking-tight transition-all duration-200 cursor-pointer flex items-center gap-2.5 border shadow-3xs ${
                              active 
                                ? `bg-white dark:bg-slate-900 ${themeAttr.accentText} border-slate-300 dark:border-slate-700 shadow-xs font-black`
                                : 'bg-white/40 dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                            }`}
                          >
                            <span className="text-base leading-none">📍</span>
                            <span>{ant.name}</span>
                            
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              active 
                                ? `${themeAttr.colorClass} border border-current/10` 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate400'
                            }`}>
                              {countFolders} {countFolders !== 1 ? 'organismes' : 'organisme'}
                            </span>

                            {antPending > 0 && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title={`${antPending} documents en attente`} />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --- SECTIONS UNDER THE ACTIVE TOWN TAB --- */}
                {activeAntenneId && (
                  <div className="space-y-5">
                    
                    {/* 5. LEVEL 1: GRID OF PARTNER ORGANIZATIONS (DOSSIERS ORGANISMES) WITHIN CURRENT CITY */}
                    {!currentFolderId ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl ${themeAttr.colorClass} flex items-center justify-center shrink-0 border border-current/10 shadow-3xs`}>
                              <FolderIcon className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                              <h3 className="text-lg font-display font-bold tracking-tight text-deep dark:text-white leading-tight">
                                Dossiers des organismes partenaires <span className="text-slate-400 font-semibold">· {selectedAntennes?.name}</span>
                              </h3>
                              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Répertoires d'archivage réglementaires pour les compagnies et associations partenaires locales.
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => setIsCreatingFolder(true)}
                            className={`flex items-center gap-1.5 text-xs font-bold text-white px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer ${
                              delegationFilterId === 'ouest' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10' :
                              delegationFilterId === 'occitanie' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' :
                              delegationFilterId === 'sud-est' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10' :
                              'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                            }`}
                          >
                            <Plus className="w-4 h-4" /> Nouveau Dossier Organisme
                          </button>
                        </div>

                        {/* Search bar inside Town tab */}
                        <div className="relative max-w-sm">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                          <input
                            type="text"
                            placeholder="Rechercher un dossier d'organisme..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-asf pl-10 text-xs"
                          />
                        </div>

                        {filteredFolders.length === 0 && unfiledFiles.length === 0 ? (
                          <div className="border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-3xs">
                            <FolderIcon className="w-12 h-12 text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-full" />
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Aucun Organisme créé</h4>
                              <p className="text-xs text-slate-400 dark:text-slate-400 mt-1 max-w-md">
                                Vous n'avez pas encore configuré de dossier d'organisme pour l'antenne locale de {selectedAntennes?.name}. Ajoutez-en un pour démarrer.
                              </p>
                            </div>
                            <button
                              onClick={() => setIsCreatingFolder(true)}
                              className={`text-xs font-black cursor-pointer hover:underline ${themeAttr.accentText}`}
                            >
                              Créer le premier dossier d'organisme maintenant
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {unfiledFiles.length > 0 && (
                              (() => {
                                const pendingUnfiled = unfiledFiles.filter(f => f.submissionStatus === 'Pending' || !f.submissionStatus).length;
                                return (
                                  <div
                                    onClick={() => { setCurrentFolderId(UNFILED_FOLDER_ID); setSearchQuery(''); }}
                                    className={`bg-amber-50/60 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-900/40 rounded-3xl p-5 shadow-3xs cursor-pointer group flex flex-col justify-between h-44 transition-all duration-300 relative hover:border-amber-400`}
                                    title="Fichiers déposés par les partenaires sans dossier"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-900/40 shadow-3xs">
                                        <AlertCircle className="w-5.5 h-5.5" />
                                      </div>
                                    </div>
                                    <div className="mt-4">
                                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 truncate">
                                        Documents non classés
                                      </h4>
                                      <p className="text-[10.5px] text-amber-700/70 dark:text-amber-400/70 mt-1 font-mono">
                                        Déposés par des partenaires hors dossier
                                      </p>
                                    </div>
                                    <div className="border-t border-amber-200/60 dark:border-amber-900/40 pt-3.5 mt-3.5 flex justify-between items-center w-full text-[11px]">
                                      <span className="font-semibold text-amber-700/80 dark:text-amber-400/80">📄 {unfiledFiles.length} document{unfiledFiles.length !== 1 ? 's' : ''}</span>
                                      {pendingUnfiled > 0 && (
                                        <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-900/35 font-black px-2.5 py-0.5 rounded-lg font-mono">
                                          🕒 {pendingUnfiled} attente
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                            {filteredFolders.map((folder) => {
                              const folderDocs = files.filter(f => f.folderId === folder.id);
                              const pendingDocs = folderDocs.filter(f => f.submissionStatus === 'Pending' || !f.submissionStatus).length;
                              return (
                                <div
                                  key={folder.id}
                                  onClick={() => { setCurrentFolderId(folder.id); setSearchQuery(''); }}
                                  className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-3xs cursor-pointer group flex flex-col justify-between h-44 transition-all duration-300 relative ${themeAttr.hoverAccent}`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className={`w-11 h-11 rounded-2xl ${themeAttr.colorClass} flex items-center justify-center shrink-0 border border-current/10 shadow-3xs`}>
                                      <FolderIcon className="w-5.5 h-5.5 fill-current" />
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setFolderToDelete(folder); }}
                                      className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                      title="Supprimer définitivement"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="mt-4">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors truncate">
                                      {folder.name}
                                    </h4>
                                    <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-1 font-mono flex items-center justify-between">
                                      <span>Créé le {new Date(folder.createdAt).toLocaleDateString()}</span>
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                        Par : {folder.createdBy === 'admin' ? 'Admin' : 'Partenaire'}
                                      </span>
                                    </p>
                                  </div>

                                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3.5 mt-3.5 flex justify-between items-center w-full text-[11px] text-slate-500">
                                    <span className="font-semibold text-slate-400">📄 {folderDocs.length} document{folderDocs.length !== 1 ? 's' : ''}</span>
                                    {pendingDocs > 0 ? (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-900/35 font-black px-2.5 py-0.5 rounded-lg font-mono">
                                        🕒 {pendingDocs} attente
                                      </span>
                                    ) : (
                                      <span className={`text-[10px] font-black ${themeAttr.accentText}`}>Cabinet à jour</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                  </div>
                ) : (
                  
                  // --- LEVEL 2: INSIDE THE ACTIVE SELECTED PARTNER DIRECTORY / FILES CABINET ---
                  <div className="space-y-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                    
                    {/* Folder Navigation line */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => { setCurrentFolderId(null); setSearchQuery(''); }}
                          className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer`}
                        >
                          <CornerLeftUp className="w-3.5 h-3.5" /> Dossiers
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <span className={`text-xs px-2.5 py-1 rounded-lg border font-black uppercase max-w-[140px] truncate ${themeAttr.badgeClass}`}>
                          📍 {selectedAntennes?.name}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <h4 className="text-sm font-black text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-800 pl-2">
                          📂 {currentFolder?.name}
                        </h4>
                      </div>

                      {/* Drop File Input buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExportZip(filteredFiles)}
                          disabled={filteredFiles.length === 0 || zipping}
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                          title="Télécharger tous les documents affichés dans une archive .zip"
                        >
                          <Archive className="w-4 h-4 text-azur" />
                          <span>{zipping ? 'Archivage…' : 'Tout télécharger (.zip)'}</span>
                        </button>
                        <label className={`flex items-center gap-1.5 text-xs font-black text-white px-4.5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer ${
                          delegationFilterId === 'ouest' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10' :
                          delegationFilterId === 'occitanie' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' :
                          delegationFilterId === 'sud-est' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10' :
                          'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                        }`}>
                          <CloudUpload className="w-4 h-4" />
                          <span>Verser un justificatif réglementaire</span>
                          <input
                            type="file"
                            onChange={handleFileChange}
                            multiple
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Folder Workspace Filter and search controls */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center text-xs">
                      
                      {/* Search Bar */}
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          data-admin-search
                          type="text"
                          placeholder="Rechercher un fichier de vol... (⌘K)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={`w-full pl-10 pr-4 py-2.5 text-xs border rounded-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 ${themeAttr.ringColor}`}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {/* Type Filtering pills */}
                        <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                          <button
                            onClick={() => setFileTypeFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              fileTypeFilter === 'all' 
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs font-black' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Tous
                          </button>
                          <button
                            onClick={() => setFileTypeFilter('pdfs')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              fileTypeFilter === 'pdfs' 
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs font-black' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => setFileTypeFilter('images')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              fileTypeFilter === 'images' 
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs font-black' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Images
                          </button>
                        </div>

                        {/* Status quick filters */}
                        <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                          <button
                            onClick={() => setFileStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${fileStatusFilter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            Tous statuts
                          </button>
                          {STATUS_ORDER.map((s) => {
                            const meta = getStatusMeta(s);
                            const active = fileStatusFilter === s;
                            return (
                              <button
                                key={s}
                                onClick={() => setFileStatusFilter(s)}
                                title={meta.label}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${active ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Sorting Selection */}
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className={`px-3 py-2 border rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800 font-bold focus:outline-none focus:ring-1 ${themeAttr.ringColor}`}
                        >
                          <option value="date-desc">Plus récent</option>
                          <option value="name-asc">Nom A-Z</option>
                        </select>
                      </div>
                    </div>

                    {/* Progress uploading indicator */}
                    {uploading && (
                      <div className={`p-4 rounded-2xl space-y-2 border ${themeAttr.badgeClass} bg-slate-50/50`}>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-4 h-4 animate-spin text-azur" />
                            Téléchargement du fichier de vol en cours...
                          </span>
                          <span className="font-mono">{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${
                            delegationFilterId === 'ouest' ? 'bg-indigo-600' :
                            delegationFilterId === 'occitanie' ? 'bg-rose-600' :
                            delegationFilterId === 'sud-est' ? 'bg-blue-600' :
                            'bg-emerald-600'
                          }`} style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      </div>
                    )}

                    {/* Documents list table */}
                    {filteredFiles.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 rounded-3xl flex flex-col items-center justify-center space-y-4">
                        <FileText className="w-12 h-12 text-slate-300" />
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Dossier vide</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                            Aucun document réglementaire n'est présent dans ce dossier d'organisme pour l'instant. Utilisez le bouton ci-dessus pour verser un justificatif.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200 bg-slate-50/80 text-slate-500">
                              <th className="px-5 py-3">Document de vol</th>
                              <th className="px-5 py-3 w-40">Taille & Format</th>
                              <th className="px-5 py-3 w-44">Date de dépôt</th>
                              <th className="px-5 py-3 w-52">Statut de validation</th>
                              <th className="px-5 py-3 text-right w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                            {filteredFiles.map((file) => {
                              const activeStatus = file.submissionStatus || 'Pending';
                              const uploaderPartner = orgProfiles.find(p => p.id === file.orgId);
                              const uploaderName = file.uploadedBy === 'admin' ? 'admin' : (uploaderPartner?.name || 'Organisme');
                              return (
                                <tr key={file.id} className="hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => setPreviewingFile(file)}>
                                  
                                  <td className="px-5 py-3.5 flex items-center gap-3 font-semibold text-slate-800" onClick={(e) => renamingFile?.id === file.id && e.stopPropagation()}>
                                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                    {renamingFile?.id === file.id ? (
                                      <form onSubmit={(e) => { e.preventDefault(); handleConfirmGeneralRename(); }} className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={renameInput}
                                          onChange={(e) => setRenameInput(e.target.value)}
                                          className="text-xs px-2 py-1 border rounded bg-white text-slate-900 focus:outline-hidden font-normal w-full"
                                          autoFocus
                                        />
                                        <button
                                          type="submit"
                                          className="bg-azur text-white hover:bg-azur-hover px-2.5 py-1 rounded text-[10.5px] font-bold cursor-pointer shrink-0"
                                        >
                                          Enregistrer
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setRenamingFile(null)}
                                          className="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer shrink-0"
                                        >
                                          Annuler
                                        </button>
                                      </form>
                                    ) : (
                                      <div className="max-w-[480px] min-w-[240px]" title={file.name}>
                                        <p className="truncate font-bold text-slate-900">{file.name}</p>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                          <span className="text-[9.5px] text-slate-400 font-mono tracking-wider">ID : {file.id.substring(0, 8)}</span>
                                          <span className="text-[9px] text-slate-300">•</span>
                                          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                            <span>Déposé par :</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight ${
                                              file.uploadedBy === 'admin' 
                                                ? 'bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50'
                                                : 'bg-azur-light text-azur dark:bg-azur/20 dark:text-azur-pastel border border-azur/30'
                                            }`}>
                                              {uploaderName}
                                            </span>
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-5 py-3.5 font-mono text-slate-500 text-[11px]">
                                    {formatBytes(file.size)} | {file.type.split('/').pop()?.toUpperCase()}
                                  </td>

                                  <td className="px-5 py-3.5 text-slate-500">
                                    {new Date(file.uploadDate).toLocaleString()}
                                  </td>

                                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                                    <div className="relative inline-block w-44 text-left group">
                                      <div className="flex items-center justify-between gap-1.5 cursor-pointer">
                                        <StatusBadge status={activeStatus} />
                                        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                                      </div>

                                      {/* Quick Status Selection list */}
                                      <div className="absolute left-0 mt-1 w-full bg-white border rounded-lg shadow-lg z-30 hidden group-hover:block hover:block font-sans">
                                        {(Object.keys(STATUS_META) as SubmissionStatus[]).map((st) => {
                                          const subSc = STATUS_META[st];
                                          return (
                                            <button
                                              key={st}
                                              onClick={() => handleUpdateStatus(file.id, st)}
                                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-[11.5px] text-slate-800 flex items-center gap-2 cursor-pointer font-bold"
                                            >
                                              <span className={`w-1.5 h-1.5 rounded-full ${subSc.dot}`}></span>
                                              <span>{subSc.label}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex justify-end gap-1.5">
                                      {file.fallbackDataUrl && (
                                        <a
                                          href={file.fallbackDataUrl}
                                          download={file.name}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={() => logAction('file_download', {
                                            targetType: 'file',
                                            targetId: file.id,
                                            targetName: file.name,
                                            antenne_id: file.antenne_id,
                                            delegation_id: file.delegation_id,
                                          })}
                                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                          title="Télécharger ou Ouvrir"
                                        >
                                          <Download className="w-4 h-4" />
                                        </a>
                                      )}
                                      <button
                                        onClick={() => {
                                          setRenamingFile(file);
                                          setRenameInput(file.name);
                                        }}
                                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-azur cursor-pointer"
                                        title="Renommer"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setFileToDelete(file)}
                                        className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                        title="Retirer définitivement"
                                      >
                                        <Trash2 className="w-4 h-4" />
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
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
              /* --- COMBINED REGIONAL MEMBERS & ACCESS VALIDATIONS SYSTEM --- */
              <div className="space-y-6 text-left">
                
                {/* Explain Banner */}
                <div className="bg-azur/5 border border-azur/15 rounded-2xl p-5 text-left space-y-2">
                  <h3 className="text-base font-display font-bold tracking-tight text-deep flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-azur" />
                    <span>Gestionnaire d'accréditations de la délégation</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    Les compagnies et associations partenaires d'Aviation Sans Frontières s'enregistrent ici. En tant que coordinateur d'Aviation Sans Frontières pour la région <strong>{selectedDelegationData?.name}</strong>, vous devez affecter une antenne locale de rattachement à chaque organisme candidat et approuver officiellement sa connexion pour activer son droit de dépôt réglementaire.
                  </p>
                </div>

                <div className="space-y-6">
                  
                  {/* Category 1: Regional Members */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-azur-light text-azur flex items-center justify-center shrink-0 border border-azur/15">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-display font-bold tracking-tight text-deep dark:text-white">
                          Comptes partenaires <span className="text-slate-400 font-semibold">· {selectedDelegationData?.name}</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Utilisateurs ayant formulé leur inscription ou rattachés à votre section de vol régionale.
                        </p>
                      </div>
                    </div>

                    {orgProfiles.filter(p => p.delegation_id === delegationFilterId).length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        Aucun partenaire enregistré sous cette délégation actuellement.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200 bg-slate-50/80 text-slate-500">
                              <th className="px-5 py-3">Raison sociale / Organisme</th>
                              <th className="px-5 py-3">Point de contact</th>
                              <th className="px-5 py-3 w-44">Rôle</th>
                              <th className="px-5 py-3 w-64">Attribution régionale</th>
                              <th className="px-5 py-3 w-40">Statut d'accès</th>
                              <th className="px-5 py-3 text-right">Décision d'accréditation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                            {orgProfiles.filter(p => p.delegation_id === delegationFilterId).map((org) => {
                              const st = org.submissionStatus || 'Pending';
                              // Le super admin gère tous les comptes. Un coordinateur de
                              // délégation gère les comptes de sa délégation, mais PAS les
                              // comptes du personnel (super admin / admin / autres coordinateurs).
                              const manageable = isSuperAdminMode || org.role === 'organization' || org.role === 'admin_antenne';
                              return (
                                <tr key={org.id} className="hover:bg-slate-50/70 transition-colors">
                                  
                                  <td className="px-5 py-4 font-bold text-slate-900">
                                    <p className="font-extrabold text-slate-900">{org.name || "Néant"}</p>
                                    <p className="text-[9.5px] text-slate-400 font-mono">UID : {org.id.substring(0, 10)}</p>
                                    {org.role === 'organization' && (() => {
                                      const of = files.filter(f => f.orgId === org.id);
                                      const val = of.filter(f => (f.submissionStatus || 'Pending') === 'Validated').length;
                                      return <div className="mt-2.5 max-w-[200px]"><ComplianceBar validated={val} total={of.length} /></div>;
                                    })()}
                                    <button
                                      onClick={() => {
                                        setSelectedOrgForFiles(org);
                                      }}
                                      className="flex items-center gap-1.5 text-[11px] font-black bg-azur-light dark:bg-azur/20 text-azur dark:text-azur-pastel border border-azur/20 dark:border-azur/40 hover:bg-azur/10 dark:hover:bg-azur/30 hover:border-azur/40 px-3 py-1.5 rounded-xl mt-2.5 transition-all shadow-3xs cursor-pointer"
                                    >
                                      📂 Cabinet & justificatifs
                                    </button>
                                  </td>

                                  <td className="px-5 py-4">
                                    <p className="font-bold text-slate-800">{org.contactName}</p>
                                    <p className="text-[11px] text-azur font-semibold">{org.email}</p>
                                    <p className="text-[11.5px] text-slate-500 font-mono">{org.phone}</p>
                                  </td>

                                  <td className="px-5 py-4">
                                    {(() => {
                                      const rm = roleMeta(org.role);
                                      return (
                                        <span
                                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10.5px] font-bold leading-tight ${rm.className}`}
                                          title={`Rôle du compte : ${rm.label}`}
                                        >
                                          <span>{rm.icon}</span>
                                          <span>{rm.label}</span>
                                        </span>
                                      );
                                    })()}
                                  </td>

                                  <td className="px-5 py-4">
                                    {editingOrgId === org.id ? (
                                      <div className="space-y-2 p-3 bg-slate-100 border border-slate-200 rounded-xl max-w-xs">
                                        <div>
                                          <label className="text-[9.5px] uppercase tracking-wider text-slate-400 font-black block">Bureau de rattachement</label>
                                          <select
                                            value={editDelegation}
                                            onChange={(e) => {
                                              setEditDelegation(e.target.value);
                                              setEditAntenne('');
                                            }}
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-800"
                                          >
                                            <option value="">Sélectionner...</option>
                                            {DELEGATIONS.map(del => (
                                              <option key={del.id} value={del.id}>{del.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="text-[9.5px] uppercase tracking-wider text-slate-400 font-black block">Ville / Antenne</label>
                                          <select
                                            value={editAntenne}
                                            onChange={(e) => setEditAntenne(e.target.value)}
                                            disabled={!editDelegation}
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-800 disabled:opacity-50"
                                          >
                                            <option value="">Sélectionner...</option>
                                            {(ANTENNES_BY_DELEGATION[editDelegation] || []).map(ant => (
                                              <option key={ant.id} value={ant.id}>{ant.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        {manageable && (
                                          <div>
                                            <label className="text-[9.5px] uppercase tracking-wider text-slate-400 font-black block">Rôle du compte</label>
                                            <select
                                              value={org.role || 'organization'}
                                              onChange={(e) => handleUpdateOrgRole(org.id, e.target.value)}
                                              className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-800"
                                              title="Définir le rôle du compte"
                                            >
                                              <option value="organization">Partenaire / Organisme</option>
                                              <option value="admin_antenne">Gestionnaire d'antenne</option>
                                              {/* Seul le super admin peut désigner un autre super administrateur. */}
                                              {isSuperAdminMode && (
                                                <option value="super_admin">Super administrateur</option>
                                              )}
                                              {/* Rôle hérité (déprécié) : affiché uniquement s'il est encore
                                                  attribué, afin que le <select> reflète la réalité et permette
                                                  de réaffecter le compte. Jamais proposé pour un nouveau compte. */}
                                              {org.role === 'admin_delegation' && (
                                                <option value="admin_delegation">Coordinateur de délégation (hérité)</option>
                                              )}
                                            </select>
                                            <p className="text-[9.5px] text-slate-400 font-semibold mt-1 leading-snug">
                                              Un <strong>gestionnaire d'antenne</strong> accède au tableau de bord de sa ville : pensez à d'abord renseigner sa <strong>ville / antenne</strong> ci-dessus, puis <strong>Enregistrer</strong>.
                                            </p>
                                          </div>
                                        )}

                                        <div className="flex gap-2 pt-1">
                                          <button
                                            onClick={() => handleSaveOrgDelegationAntenne(org.id)}
                                            disabled={!editDelegation || !editAntenne}
                                            className="bg-azur hover:bg-azur-hover text-white text-[10px] uppercase font-black px-2.5 py-1.5 rounded-lg cursor-pointer transition-all disabled:opacity-50"
                                          >
                                            Enregistrer
                                          </button>
                                          <button
                                            onClick={() => setEditingOrgId(null)}
                                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] uppercase font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                                          >
                                            Annuler
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <p className="font-bold text-slate-900 capitalize text-[13px] flex items-center gap-1">
                                          <span>⛵ {DELEGATIONS.find(d => d.id === org.delegation_id)?.name || "Non défini"}</span>
                                        </p>
                                        <p className="text-[11.5px] text-slate-400 font-semibold font-mono">
                                          📍 {org.antenne_id ? (ANTENNES_BY_DELEGATION[org.delegation_id || '']?.find(a => a.id === org.antenne_id)?.name || org.antenne_id) : "Non affecté"}
                                        </p>
                                        {manageable && (
                                          <button
                                            onClick={() => {
                                              setEditingOrgId(org.id);
                                              setEditDelegation(org.delegation_id || '');
                                              setEditAntenne(org.antenne_id || '');
                                            }}
                                            className="text-[11px] text-azur hover:underline font-black mt-2 block cursor-pointer"
                                          >
                                            ✏️ Modifier la ville
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-5 py-4">
                                    <StatusBadge status={st} />
                                  </td>

                                  <td className="px-5 py-4 text-right">
                                    <div className="flex justify-end gap-1.5">
                                      {manageable && org.submissionStatus !== 'Validated' && (
                                        <button
                                          onClick={() => handleUpdateOrgStatus(org.id, 'Validated')}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11.5px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs"
                                        >
                                          ✓ Approuver
                                        </button>
                                      )}

                                      {manageable && org.submissionStatus === 'Validated' && (
                                        <button
                                          onClick={() => handleUpdateOrgStatus(org.id, 'Incomplete')}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-800 font-extrabold border border-rose-200 text-[11.5px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all"
                                        >
                                          ✗ Suspendre
                                        </button>
                                      )}

                                      {manageable && (
                                        <button
                                          onClick={() => handleDeleteOrg(org)}
                                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11.5px] px-3 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs inline-flex items-center gap-1"
                                          title="Supprimer définitivement ce compte"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Category 2: Orphan Accounts waitlist (super admin uniquement :
                      l'adoption de comptes sans délégation est une action nationale). */}
                  {isSuperAdminMode && (
                  <div className="bg-amber-500/5 border border-amber-200/40 rounded-2xl p-6 shadow-xs space-y-4">
                    <div>
                      <h4 className="text-base font-display font-bold tracking-tight text-amber-900 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />
                        <span>Candidatures hors délégation (comptes orphelins à lier à une antenne)</span>
                      </h4>
                      <p className="text-xs text-amber-900 font-semibold leading-relaxed">
                        Ces candidats se sont enregistrés en ligne mais leur profil n'est affecté à aucun bureau. En tant que coordinateur, vous pouvez adopter leur compte dans votre délégation, leur attribuer une ville et leur donner un accès direct.
                      </p>
                    </div>

                    {orgProfiles.filter(p => !p.delegation_id || p.delegation_id === '').length === 0 ? (
                      <div className="py-8 text-center text-xs text-amber-700 font-semibold italic">
                        ✓ Aucune candidature orpheline nationale en suspens.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-amber-200 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[11px] font-semibold uppercase tracking-wider border-b border-amber-200 bg-amber-50 text-amber-800">
                              <th className="px-5 py-3">Adresse de connexion</th>
                              <th className="px-5 py-3">Profil renseigné</th>
                              <th className="px-5 py-3 w-64">Attribution interne</th>
                              <th className="px-5 py-3 text-right">Action d'accréditation d'urgence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100/70 text-slate-700 text-xs">
                            {orgProfiles.filter(p => !p.delegation_id || p.delegation_id === '').map((org) => {
                              return (
                                <tr key={org.id} className="hover:bg-amber-50/40 transition-colors">
                                  
                                  <td className="px-5 py-4 font-black text-slate-900">
                                    <p className="text-amber-900 font-mono font-black text-[13px]">{org.email}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">UID : {org.id.substring(0, 10)}</p>
                                  </td>

                                  <td className="px-5 py-4">
                                    <p className="font-extrabold text-slate-900">{org.name || "Organisme non précisé"}</p>
                                    <p className="text-[11px] text-slate-500 font-semibold">Contact: {org.contactName || "Non défini"}</p>
                                    <p className="text-[11px] text-slate-500 font-mono">Tél: {org.phone || "Aucun"}</p>
                                  </td>

                                  <td className="px-5 py-4">
                                    {editingOrgId === org.id ? (
                                      <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                        <div>
                                          <label className="text-[9.5px] uppercase tracking-wider text-slate-400 font-black block">Délégation d'accueil</label>
                                          <select
                                            value={editDelegation}
                                            onChange={(e) => {
                                              setEditDelegation(e.target.value);
                                              setEditAntenne('');
                                            }}
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-800"
                                          >
                                            <option value="">Sélectionner...</option>
                                            {DELEGATIONS.map(del => (
                                              <option key={del.id} value={del.id}>{del.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="text-[9.5px] uppercase tracking-wider text-slate-400 font-black block">Antenne locale / Ville</label>
                                          <select
                                            value={editAntenne}
                                            onChange={(e) => setEditAntenne(e.target.value)}
                                            disabled={!editDelegation}
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-800 disabled:opacity-50"
                                          >
                                            <option value="">Sélectionner...</option>
                                            {(ANTENNES_BY_DELEGATION[editDelegation] || []).map(ant => (
                                              <option key={ant.id} value={ant.id}>{ant.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="flex gap-2 pt-1">
                                          <button
                                            onClick={() => handleSaveOrgDelegationAntenne(org.id)}
                                            disabled={!editDelegation || !editAntenne}
                                            className="bg-azur hover:bg-azur-hover text-white text-[10px] uppercase font-black px-2 py-1 rounded-lg cursor-pointer transition-all disabled:opacity-50"
                                          >
                                            Lier le compte
                                          </button>
                                          <button
                                            onClick={() => setEditingOrgId(null)}
                                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] uppercase font-bold px-2 py-1 rounded-lg cursor-pointer transition-all"
                                          >
                                            Annuler
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2.5 py-1 rounded-full block text-center max-w-[140px]">
                                          ⚠️ Non affecté
                                        </span>
                                        <button
                                          onClick={() => {
                                            setEditingOrgId(org.id);
                                            setEditDelegation(delegationFilterId || '');
                                            setEditAntenne('');
                                          }}
                                          className="text-xs text-azur hover:underline font-black mt-2 block cursor-pointer"
                                        >
                                          ⚡ Lier à ma délégation
                                        </button>
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-5 py-4 text-right">
                                    <button
                                      onClick={async () => {
                                        if (delegationFilterId) {
                                          const defaultCity = ANTENNES_BY_DELEGATION[delegationFilterId]?.[0]?.id || '';
                                          try {
                                            await updateDoc(doc(db, 'organizations', org.id), {
                                              delegation_id: delegationFilterId,
                                              antenne_id: defaultCity,
                                              submissionStatus: 'Validated',
                                              updatedAt: Date.now()
                                            });
                                            logAction('org_assign_antenne', {
                                              targetType: 'organization',
                                              targetId: org.id,
                                              targetName: org.name,
                                              delegation_id: delegationFilterId,
                                              antenne_id: defaultCity,
                                              details: 'Compte associé à la délégation et activé',
                                            });
                                          } catch (err) {
                                            console.error("Error direct approving:", err);
                                          }
                                        } else {
                                          toast("Veuillez d'abord sélectionner une délégation ci-dessus pour y affecter cet utilisateur.", 'warning');
                                        }
                                      }}
                                      className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11.5px] px-3.5 py-2 rounded-xl cursor-pointer transition-all shadow-xs"
                                    >
                                      ✓ Associer & Activer l'accès
                                    </button>
                                  </td>

                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'delegations' && (
              <div className="space-y-6 text-left">
                {/* Visual Sky Banner */}
                <div className="bg-azur-light dark:bg-deep-dark/30 border border-azur-pastel dark:border-deep/60 p-5 text-left space-y-2 rounded-2xl">
                  <h3 className="text-base font-display font-bold tracking-tight text-deep dark:text-azur-pastel flex items-center gap-2">
                    <Compass className="w-5 h-5 text-azur-hover dark:text-azur animate-spin" />
                    <span>Réseau national Aviation Sans Frontières — carte interactive de France</span>
                  </h3>
                  <p className="text-xs text-azur-dark dark:text-azur leading-relaxed font-medium">
                    Cartographiez en direct l'implantation de vos antennes. Cliquez sur la carte de France pour désigner/modifier précisément l'emplacement d'une antenne nationale, ou cliquez sur un repère existant pour modifier ses détails.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT COLUMN: CARTE INTERACTIVE DE LA FRANCE (SVG) */}
                  <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-4 flex flex-col items-center">
                    <div className="flex justify-between items-center w-full pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Positionnement Géographique
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {editingAntenne ? "Cliquez sur la carte pour repositionner l'antenne sélectionnée" : "Cliquez sur la carte pour définir l'emplacement d'une nouvelle antenne"}
                        </p>
                      </div>
                      {tempCoords ? (
                        <button
                          onClick={() => setTempCoords(null)}
                          className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg font-bold hover:bg-amber-500/20 transition-all cursor-pointer"
                        >
                          Réinitialiser le marqueur ✕
                        </button>
                      ) : editingAntenne ? (
                        <button
                          onClick={() => setEditingAntenne(null)}
                          className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg font-bold hover:bg-amber-500/20 transition-all cursor-pointer"
                        >
                          Quitter l'édition ✕
                        </button>
                      ) : (
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-lg font-mono">
                          Aucun point sélectionné
                        </span>
                      )}
                    </div>

                    {/* SVG France Map Container */}
                    <div className="w-full bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/80 p-4 flex items-center justify-center relative overflow-hidden group">
                      <svg
                        viewBox="0 0 600 600"
                        className="w-full max-w-[480px] h-auto cursor-crosshair select-none relative z-10 drop-shadow-sm filter dark:drop-shadow-[0_0_15px_rgba(30,41,59,0.5)]"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          const roundedX = Math.round(x * 10) / 10;
                          const roundedY = Math.round(y * 10) / 10;
                          if (editingAntenne) {
                            setEditingAntenne(prev => prev ? { ...prev, x: roundedX, y: roundedY } : null);
                          } else {
                            setTempCoords({ x: roundedX, y: roundedY });
                          }
                        }}
                      >
                        {/* Sea/Ocean Accent Grid */}
                        <g className="stroke-slate-100/40 dark:stroke-slate-800/20 stroke-[0.5]" pointerEvents="none">
                          <line x1="100" y1="0" x2="100" y2="600" />
                          <line x1="200" y1="0" x2="200" y2="600" />
                          <line x1="300" y1="0" x2="300" y2="600" />
                          <line x1="400" y1="0" x2="400" y2="600" />
                          <line x1="500" y1="0" x2="500" y2="600" />
                          <line x1="0" y1="100" x2="600" y2="100" />
                          <line x1="0" y1="200" x2="600" y2="200" />
                          <line x1="0" y1="300" x2="600" y2="300" />
                          <line x1="0" y1="400" x2="600" y2="400" />
                          <line x1="0" y1="500" x2="600" y2="500" />
                        </g>

                        {/* Real metropolitan France outline (geographic projection) */}
                        <polygon
                          points={toSvgPoints(FRANCE_MAINLAND, 6)}
                          className="fill-azur-light dark:fill-slate-800/20 stroke-azur-pastel dark:stroke-slate-700 stroke-2 outline-none transition-colors duration-300"
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />

                        {/* Captions representing oceanic borders */}
                        <text x="120" y="70" className="fill-slate-400/60 dark:fill-slate-600/40 text-[10px] font-bold tracking-widest pointer-events-none uppercase font-sans">La Manche</text>
                        <text x="40" y="380" className="fill-slate-400/60 dark:fill-slate-600/40 text-[10px] font-bold tracking-widest pointer-events-none uppercase font-sans">Océan Atlantique</text>
                        <text x="350" y="540" className="fill-slate-400/60 dark:fill-slate-600/40 text-[10px] font-bold tracking-widest pointer-events-none uppercase font-sans">Mer Méditerranée</text>

                        {/* Corsica */}
                        <polygon
                          points={toSvgPoints(FRANCE_CORSICA, 6)}
                          className="fill-azur-light dark:fill-slate-800/20 stroke-azur-pastel dark:stroke-slate-700 stroke-2 transition-all duration-350"
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />

                        {/* Permanent Active Antennas Beacons */}
                        {(ANTENNES_BY_DELEGATION['france'] || []).map((ant) => {
                          const x = ant.x !== undefined ? ant.x : 50;
                          const y = ant.y !== undefined ? ant.y : 50;
                          const isCurrentlySelected = editingAntenne?.id === ant.id;
                          return (
                            <g
                              key={ant.id}
                              className="group/pin cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAntenne({
                                  id: ant.id,
                                  name: ant.name,
                                  x: ant.x !== undefined ? ant.x : 50,
                                  y: ant.y !== undefined ? ant.y : 50
                                });
                                setTempCoords(null);
                              }}
                            >
                              <circle
                                cx={x * 6}
                                cy={y * 6}
                                r={isCurrentlySelected ? "18" : "12"}
                                className={`${
                                  isCurrentlySelected 
                                    ? "fill-amber-400/30 stroke-amber-500 animate-pulse stroke-2" 
                                    : "fill-azur/20 group-hover/pin:fill-azur/40 stroke-azur stroke-[1.5]"
                                } transition-all duration-305 pointer-events-none`}
                              />
                              <circle
                                cx={x * 6}
                                cy={y * 6}
                                r={isCurrentlySelected ? "6" : "4"}
                                className={`${
                                  isCurrentlySelected 
                                    ? "fill-amber-500 stroke-dark" 
                                    : "fill-azur stroke-white dark:stroke-slate-900 stroke-2"
                                } transition-transform duration-350 group-hover/pin:scale-125`}
                              />
                              
                              {/* Label Backdrop + Label Text */}
                              <g className={`${isCurrentlySelected ? "opacity-100" : "opacity-0 group-hover/pin:opacity-100"} transition-opacity duration-200 pointer-events-none`}>
                                <rect
                                  x={x * 6 - 72}
                                  y={y * 6 - 32}
                                  width="144"
                                  height="22"
                                  rx="6"
                                  className={`${isCurrentlySelected ? "fill-amber-950/95 dark:fill-amber-900" : "fill-slate-950/95 dark:fill-slate-900"} border border-slate-700 shadow-md`}
                                />
                                <text
                                  x={x * 6}
                                  y={y * 6 - 18}
                                  textAnchor="middle"
                                  className="fill-white font-sans text-[10px] font-black tracking-wide"
                                >
                                  {ant.name}
                                </text>
                              </g>
                            </g>
                          );
                        })}

                        {/* Interactive Temporary Marqueur (Glowing Green Beacon) */}
                        {tempCoords && (
                          <g className="animate-pulse">
                            <circle
                              cx={tempCoords.x * 6}
                              cy={tempCoords.y * 6}
                              r="15"
                              className="fill-emerald-400/20 stroke-emerald-500 stroke-2"
                            />
                            <circle
                              cx={tempCoords.x * 6}
                              cy={tempCoords.y * 6}
                              r="5"
                              className="fill-emerald-500 stroke-white stroke-2"
                            />
                            <text
                              x={tempCoords.x * 6}
                              y={tempCoords.y * 6 - 12}
                              textAnchor="middle"
                              className="fill-emerald-600 dark:fill-emerald-400 font-mono text-[9px] font-extrabold"
                            >
                              Nouveau point ({tempCoords.x}%, {tempCoords.y}%)
                            </text>
                          </g>
                        )}
                      </svg>
                    </div>

                    {/* Recaler toutes les antennes existantes sur leur ville */}
                    <button
                      type="button"
                      onClick={handleRecalibrateAllAntennes}
                      disabled={recalibrating}
                      className="w-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 px-3 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      title="Géocode chaque antenne par son nom de ville et corrige sa position sur la carte"
                    >
                      {recalibrating ? (
                        <>⏳ Recalage en cours…</>
                      ) : (
                        <>🧭 Recaler toutes les antennes sur leur ville</>
                      )}
                    </button>
                  </div>

                  {/* RIGHT COLUMN: CONFIGURATION FORM OR DETAILED VISUAL EDIT PANEL */}
                  <div className="lg:col-span-5 space-y-6">
                    {editingAntenne ? (
                      /* VISUAL LIVE EDITING PANEL */
                      <div className="bg-amber-500/5 dark:bg-amber-500/2 bg-white border border-amber-500/30 p-6 space-y-4 rounded-2xl shadow-xs text-left">
                        <div className="pb-2 border-b border-amber-500/20 flex justify-between items-center">
                          <div>
                            <h4 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Edit2 className="w-4 h-4" />
                              <span>Modifier l'Antenne</span>
                            </h4>
                            <p className="text-[10.5px] text-slate-400 mt-1">
                              ID : <strong className="font-mono">{editingAntenne.id}</strong>
                            </p>
                          </div>
                          <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg font-bold uppercase">
                            Édition Active
                          </span>
                        </div>

                        <form onSubmit={handleUpdateAntenneDetails} className="space-y-4">
                          {/* Live coordinate sliders matching real physical layout */}
                          <div className="space-y-3 p-3 bg-amber-500/10 border border-amber-500/15 rounded-xl">
                            <div>
                              <div className="flex justify-between text-[10px] font-extrabold text-slate-500 uppercase">
                                <span>Position X (Est)</span>
                                <span className="font-mono text-amber-600 dark:text-amber-400">{editingAntenne.x}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={editingAntenne.x}
                                onChange={(e) => setEditingAntenne(prev => prev ? { ...prev, x: parseFloat(e.target.value) } : null)}
                                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-[10px] font-extrabold text-slate-500 uppercase">
                                <span>Position Y (Sud)</span>
                                <span className="font-mono text-amber-600 dark:text-amber-400">{editingAntenne.y}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={editingAntenne.y}
                                onChange={(e) => setEditingAntenne(prev => prev ? { ...prev, y: parseFloat(e.target.value) } : null)}
                                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={geocoding || !editingAntenne.name.trim()}
                            onClick={async () => {
                              const coords = await geocodeCity(editingAntenne.name);
                              if (coords) {
                                const c = lonLatToXY(coords[0], coords[1]);
                                setEditingAntenne(prev => prev ? { ...prev, x: c.x, y: c.y } : null);
                                toast(`Antenne positionnée sur ${editingAntenne.name}.`, 'success');
                              } else {
                                toast("Ville introuvable — positionnez manuellement sur la carte.", 'warning');
                              }
                            }}
                            className="w-full text-[11px] bg-azur-light text-azur-dark dark:text-azur-pastel border border-azur-pastel/80 hover:bg-azur-pastel/40 font-bold px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            📍 Placer automatiquement sur la ville « {editingAntenne.name || '…'} »
                          </button>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                              Nom à Afficher sur la Carte
                            </label>
                            <input
                              type="text"
                              required
                              value={editingAntenne.name}
                              onChange={(e) => setEditingAntenne(prev => prev ? { ...prev, name: e.target.value } : null)}
                              className="input-asf mt-1 text-xs font-bold focus:ring-amber-500/25 focus:border-amber-500"
                            />
                          </div>

                          {antenneGroups.length > 0 && (
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5">
                                Groupes d'antennes
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {antenneGroups.map((grp) => {
                                  const member = grp.antenneIds.includes(editingAntenne.id);
                                  return (
                                    <button
                                      key={grp.id}
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await toggleAntenneInGroup(grp, editingAntenne.id, !member);
                                          logAction('antenne_group_change', {
                                            targetType: 'antenne',
                                            targetId: editingAntenne.id,
                                            targetName: editingAntenne.name,
                                            antenne_id: editingAntenne.id,
                                            delegation_id: delegationFilterId || '',
                                            details: `${!member ? 'Ajoutée au' : 'Retirée du'} groupe « ${grp.name} »`,
                                          });
                                        } catch (err: any) {
                                          toast("Erreur lors de la mise à jour des groupes : " + (err?.message || err), 'error');
                                        }
                                      }}
                                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                        member
                                          ? 'bg-azur text-white border-azur'
                                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-azur/50'
                                      }`}
                                    >
                                      <span className="w-2 h-2 rounded-full border border-black/10" style={{ backgroundColor: grp.color || '#1b98c4' }} />
                                      {member ? '✓ ' : ''}{grp.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={actionLoading || !editingAntenne.name.trim()}
                              className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition duration-150 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>Enregistrer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAntenne(null)}
                              className="btn-secondary text-xs cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      /* DISCOVERY & CREATION MODE */
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 rounded-2xl shadow-xs text-left">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                            Ajouter une Antenne Nationale
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            Associez l'antenne à un point géographique. Cliquez sur la carte de France à gauche ou utilisez le panneau de présélection express.
                          </p>
                        </div>

                        <form onSubmit={handleAddAntenne} className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                                Position X (horizontal)
                              </label>
                              <input
                                type="number"
                                disabled
                                value={tempCoords ? tempCoords.x : 50}
                                className="w-full mt-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 rounded-xl text-xs font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                                Position Y (vertical)
                              </label>
                              <input
                                type="number"
                                disabled
                                value={tempCoords ? tempCoords.y : 50}
                                className="w-full mt-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 rounded-xl text-xs font-mono"
                              />
                            </div>
                          </div>

                          {tempCoords && (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ Position désignée : <strong className="font-mono">{tempCoords.x}% Est</strong> et <strong className="font-mono">{tempCoords.y}% Sud</strong>.
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                              Nom de l'Antenne / Ville
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="ex: Lyon"
                              value={newAntenneName}
                              onChange={(e) => {
                                setNewAntenneName(e.target.value);
                                const slugified = e.target.value
                                  .toLowerCase()
                                  .normalize("NFD")
                                  .replace(/[\u0300-\u036f]/g, "")
                                  .replace(/[^a-z0-9]/g, '-')
                                  .replace(/-+/g, '-')
                                  .replace(/^-|-$/g, '');
                                setNewAntenneId(slugified);
                              }}
                              className="input-asf mt-1 text-xs font-bold"
                            />
                            <p className="text-[10px] mt-1 font-semibold flex items-center gap-1 text-slate-400">
                              {geocoding
                                ? <span className="text-azur">📍 Localisation automatique…</span>
                                : tempCoords
                                  ? <span className="text-emerald-600 dark:text-emerald-400">✓ Position placée automatiquement sur la carte</span>
                                  : <span>Tapez une ville française : sa position se place toute seule.</span>}
                            </p>
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                              Identifiant technique (Slug unique)
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="ex: lyon"
                              value={newAntenneId}
                              onChange={(e) => setNewAntenneId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                              className="w-full mt-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 rounded-xl font-mono text-xs focus:outline-none"
                            />
                          </div>

                          {antenneGroups.length > 0 && (
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5">
                                Groupes d'antennes (optionnel)
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {antenneGroups.map((grp) => {
                                  const checked = newAntenneGroupIds.includes(grp.id);
                                  return (
                                    <button
                                      key={grp.id}
                                      type="button"
                                      onClick={() => setNewAntenneGroupIds(prev =>
                                        checked ? prev.filter(id => id !== grp.id) : [...prev, grp.id]
                                      )}
                                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                        checked
                                          ? 'bg-azur text-white border-azur'
                                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-azur/50'
                                      }`}
                                    >
                                      <span className="w-2 h-2 rounded-full border border-black/10" style={{ backgroundColor: grp.color || '#1b98c4' }} />
                                      {checked ? '✓ ' : ''}{grp.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={actionLoading || !newAntenneName.trim() || !newAntenneId.trim()}
                            className="btn-asf w-full text-xs cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Confirmer l'ajout</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                </div>

                {/* LISTE RÉCAPITULATIVE INTERACTIVE */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-azur-light text-azur flex items-center justify-center shrink-0 border border-azur/15">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-display font-bold tracking-tight text-deep dark:text-white">
                        Gestion des antennes actives <span className="text-slate-400 font-semibold">· {(ANTENNES_BY_DELEGATION['france'] || []).length}</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Consultez la liste des antennes locales rattachées à l'infrastructure nationale d'Aviation Sans Frontières.
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const antList = ANTENNES_BY_DELEGATION['france'] || [];
                    const groupedSections = antenneGroups
                      .map((g) => ({ group: g, items: antList.filter((a) => g.antenneIds?.includes(a.id)) }))
                      .filter((s) => s.items.length > 0)
                      .sort((a, b) => a.group.name.localeCompare(b.group.name));
                    const ungrouped = antList.filter(
                      (a) => !antenneGroups.some((g) => g.antenneIds?.includes(a.id)),
                    );

                    if (antList.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 italic py-4 text-center">
                          Aucune antenne active pour le moment.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {groupedSections.map(({ group, items }) => (
                          <div key={group.id} className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                                style={{ backgroundColor: group.color || '#1b98c4' }}
                              />
                              <h5 className="text-xs font-display font-bold tracking-tight text-deep dark:text-white uppercase">
                                {group.name}
                              </h5>
                              <span className="text-[11px] text-slate-400 font-semibold">· {items.length}</span>
                              <span className="flex-1 h-px bg-slate-200/70 dark:bg-slate-800" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                              {items.map((ant) => renderAntenneCard(ant))}
                            </div>
                          </div>
                        ))}

                        {ungrouped.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-300 border border-black/10" />
                              <h5 className="text-xs font-display font-bold tracking-tight text-slate-500 uppercase">
                                Sans groupe
                              </h5>
                              <span className="text-[11px] text-slate-400 font-semibold">· {ungrouped.length}</span>
                              <span className="flex-1 h-px bg-slate-200/70 dark:bg-slate-800" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                              {ungrouped.map((ant) => renderAntenneCard(ant))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {isSuperAdminMode && (
                  <AntenneGroupsManager groups={antenneGroups} antennes={allAntennesFlat} />
                )}

                {isSuperAdminMode && (
                  <AntenneAdminsManager
                    orgProfiles={orgProfiles}
                    delegations={DELEGATIONS}
                    antennes={ANTENNES_BY_DELEGATION}
                  />
                )}
              </div>
            )}
          </div>
        );
      })()}
    </main>

      {/* --- INTEGRATED MODALS FOR COORDINATION PANEL --- */}
      <DeleteConfirmModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={confirmDeleteFile}
        itemName={fileToDelete?.name || ''}
        itemType="file"
      />

      <DeleteConfirmModal
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={confirmDeleteFolder}
        itemName={folderToDelete?.name || ''}
        itemType="folder"
      />

      <CreateFolderModal
        isOpen={isCreatingFolder}
        onClose={() => setIsCreatingFolder(false)}
        onConfirm={handleCreateFolder}
      />

      <FilePreviewModal
        isOpen={!!previewingFile}
        onClose={() => setPreviewingFile(null)}
        file={previewingFile}
        onDelete={(f) => {
          setPreviewingFile(null);
          setFileToDelete(f);
        }}
        orgName="Aviation Sans Frontières"
        isAdmin={true}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <GuidedTour open={!!activeTour} steps={activeTour || []} onClose={() => setActiveTour(null)} />

      {/* --- REAL-TIME DOCUMENT CABINET FOR INDIVIDUAL PROFILES --- */}
      <AnimatePresence>
        {selectedOrgForFiles && (
          <OrgCabinetModal
            selectedOrgForFiles={selectedOrgForFiles}
            files={files}
            folders={folders}
            delegationFilterId={delegationFilterId}
            onClose={() => setSelectedOrgForFiles(null)}
            setFiles={setFiles}
            setFolders={setFolders}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
