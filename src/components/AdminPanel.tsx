import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
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
import { localDb } from '../lib/localDb';
import { formatBytes } from '../lib/utils';
import { setAntenneMembership, removeAntenneFromAllGroups, toggleAntenneInGroup } from '../lib/antenneGroups';
import { StatusBadge } from './ui';
import { STATUS_META } from '../lib/status';

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
    gradientClass: 'from-indigo-500/10 to-sky-500/5',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900',
    bgDecorative: 'bg-indigo-500/10',
    icon: '⛵',
    bannerBorder: 'border-indigo-100 dark:border-indigo-900/60',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    hoverAccent: 'hover:border-indigo-405 hover:bg-indigo-50/10 hover:shadow-indigo-500/5',
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
    accentText: 'text-slate-755 dark:text-slate-300',
    hoverAccent: 'hover:border-slate-400 hover:bg-slate-50/10',
    ringColor: 'focus:ring-slate-500'
  }
};

export default function AdminPanel() {
  const { organization, signOut, delegations: DELEGATIONS, antennes: ANTENNES_BY_DELEGATION, antenneGroups } = useAuth();
  const { themeConfig } = useTheme();
  const { toast, confirm } = useFeedback();

  // Active Simulated Role State (For easy local testing of Admin roles)
  const [simulationRole, setSimulationRole] = useState<'super_admin' | 'admin'>(() => {
    if (organization?.role === 'admin') {
      return 'admin';
    }
    return 'super_admin';
  });

  const isSuperAdminMode = simulationRole === 'super_admin';
  
  const [activeDelegationId, setActiveDelegationId] = useState<string | null>('france');
  const delegationFilterId = activeDelegationId ?? 'france';
  const [tempCoords, setTempCoords] = useState<{ x: number; y: number } | null>(null);

  // New State for full interactive Visual Antenna Editing
  const [editingAntenne, setEditingAntenne] = useState<{ id: string; name: string; x: number; y: number } | null>(null);

  // Selected Town (onglet de ville)
  const [activeAntenneId, setActiveAntenneId] = useState<string | null>(null);

  // Auto-select antenna for local antenna coordinators
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
  const [sortBy, setSortBy] = useState('date-desc');

  // Multi-tab support: workspaces for dossiers, members for validation and user access, plus config for superadmin
  const [activeTab, setActiveTab] = useState<'workspaces' | 'members' | 'delegations'>('workspaces');

  // Simple Admin Navigation Hub State
  const [navigationView, setNavigationView] = useState<'hub' | 'ailes' | 'users' | 'implantations'>('hub');

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

  const handleAddDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelegationName.trim() || !newDelegationId.trim()) return;
    setActionLoading(true);
    try {
      const cleanId = newDelegationId.toLowerCase().trim();
      await setDoc(doc(db, 'delegations', cleanId), {
        name: newDelegationName.trim()
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
    setActionLoading(true);
    try {
      await setDoc(doc(db, 'antennes', antId), {
        deleted: true,
        updatedAt: Date.now()
      }, { merge: true });
      // Nettoyage : retirer cette antenne de tous les groupes qui la contiennent.
      try {
        await removeAntenneFromAllGroups(antId, antenneGroups);
      } catch (groupErr) {
        console.error("Error cleaning antenne from groups:", groupErr);
      }
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
    setActionLoading(true);
    try {
      await setDoc(doc(db, 'antennes', editingAntenne.id), {
        name: editingAntenne.name.trim(),
        x: editingAntenne.x,
        y: editingAntenne.y,
        updatedAt: Date.now()
      }, { merge: true });
      setEditingAntenne(null);
    } catch (err: any) {
      console.error("Error updating antenne:", err);
      toast("Erreur lors de la modification de l'antenne : " + err.message, 'error');
    } finally {
      setActionLoading(false);
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
    if (localDb.isSandboxActive()) {
      const orgs = localDb.getOrganizations();
      const target = orgs.find(o => o.id === orgId);
      if (target) {
        target.submissionStatus = status;
        target.updatedAt = Date.now();
        localDb.saveOrganization(target);
      }
      setOrgProfiles(localDb.getOrganizations());
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        submissionStatus: status,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Error updating organization space state:", err);
    }
  };

  const handleUpdateOrgRole = async (orgId: string, newRole: string) => {
    if (localDb.isSandboxActive()) {
      const orgs = localDb.getOrganizations();
      const target = orgs.find(o => o.id === orgId);
      if (target) {
        target.role = newRole as any;
        target.updatedAt = Date.now();
        localDb.saveOrganization(target);
      }
      setOrgProfiles(localDb.getOrganizations());
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        role: newRole,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Error updating user role:", err);
    }
  };

  const handleSaveOrgDelegationAntenne = async (orgId: string) => {
    if (!editDelegation || !editAntenne) return;
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
      setEditingOrgId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        delegation_id: editDelegation,
        antenne_id: editAntenne,
        updatedAt: Date.now()
      });
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
      try {
        const qFiles = query(collection(db, 'files'));
        unsubFiles = onSnapshot(qFiles, (snapshot) => {
          const filesData: DossierFile[] = [];
          snapshot.forEach((doc) => {
            filesData.push({ id: doc.id, ...doc.data() } as DossierFile);
          });
          setFiles(filesData);
        }, (err) => {
          console.warn("Firestore files snapshot error. Switching to Local Storage Sandbox fallback:", err);
          localDb.setSandboxActive(true);
          loadLocalData();
        });
      } catch (err) {
        console.warn("Firestore files connect failed. Fallback:", err);
        localDb.setSandboxActive(true);
        loadLocalData();
      }

      try {
        const qFolders = query(collection(db, 'folders'));
        unsubFolders = onSnapshot(qFolders, (snapshot) => {
          const foldersData: Folder[] = [];
          snapshot.forEach((doc) => {
            foldersData.push({ id: doc.id, ...doc.data() } as Folder);
          });
          setFolders(foldersData);
        }, (err) => {
          console.warn("Firestore folders snapshot error:", err);
          localDb.setSandboxActive(true);
          loadLocalData();
        });
      } catch (err) {
        localDb.setSandboxActive(true);
        loadLocalData();
      }

      try {
        const qOrgs = query(collection(db, 'organizations'));
        unsubOrgs = onSnapshot(qOrgs, (snapshot) => {
          const orgsData: Organization[] = [];
          snapshot.forEach((doc) => {
            orgsData.push({ id: doc.id, ...doc.data() } as Organization);
          });
          setOrgProfiles(orgsData);
        }, (err) => {
          console.warn("Firestore user profiles snapshot error:", err);
          localDb.setSandboxActive(true);
          loadLocalData();
        });
      } catch (err) {
        localDb.setSandboxActive(true);
        loadLocalData();
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

    for (const f of selectedFiles) {
      if (localDb.isSandboxActive()) {
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = () => {
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
              fallbackDataUrl: reader.result as string,
              uploadDate: Date.now(),
              uploadedBy: 'admin',
              submissionStatus: 'Pending'
            };
            localDb.saveFile(mockFile);
            resolve();
          };
          reader.readAsDataURL(f);
        });
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
      } catch (err: any) {
        console.error("Upload error:", err);
        // Fallback Base64 for sandbox compatibility if Storage blocks
        try {
          const fallbackUrl = await new Promise<string>((resolveBase64) => {
            const r = new FileReader();
            r.onload = () => resolveBase64(r.result as string);
            r.readAsDataURL(f);
          });
          
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
    } catch (err) {
      console.error("Error creating folder:", err);
    }
  };

  // File and Folder modifications
  const handleUpdateStatus = async (fileId: string, newStatus: SubmissionStatus) => {
    if (localDb.isSandboxActive()) {
      const filesList = localDb.getFiles();
      const target = filesList.find(f => f.id === fileId);
      if (target) {
        target.submissionStatus = newStatus;
        localDb.saveFile(target);
      }
      setFiles(localDb.getFiles());
      return;
    }
    try {
      await updateDoc(doc(db, 'files', fileId), {
        submissionStatus: newStatus
      });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleConfirmGeneralRename = async () => {
    if (!renamingFile || !renameInput.trim() || renameInput.trim() === renamingFile.name) {
      setRenamingFile(null);
      return;
    }
    if (localDb.isSandboxActive()) {
      const filesList = localDb.getFiles();
      const target = filesList.find(f => f.id === renamingFile.id);
      if (target) {
        target.name = renameInput.trim();
        localDb.saveFile(target);
      }
      setFiles(localDb.getFiles());
      setRenamingFile(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'files', renamingFile.id), {
        name: renameInput.trim()
      });
      setRenamingFile(null);
    } catch (err) {
      console.error("Error renaming file:", err);
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    if (localDb.isSandboxActive()) {
      localDb.deleteFile(fileToDelete.id);
      setFiles(localDb.getFiles());
      setFileToDelete(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'files', fileToDelete.id));
      setFileToDelete(null);
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    if (localDb.isSandboxActive()) {
      localDb.deleteFolder(folderToDelete.id);
      setFiles(localDb.getFiles());
      setFolders(localDb.getFolders());
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
    if (f.folderId !== currentFolderId) return false;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesType = true;
    if (fileTypeFilter === 'pdfs') {
      matchesType = f.type === 'application/pdf' || f.name.endsWith('.pdf');
    } else if (fileTypeFilter === 'images') {
      matchesType = f.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(f.name);
    }
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    return b.uploadDate - a.uploadDate; // default date desc
  });

  const selectedDelegationData = DELEGATIONS.find(d => d.id === delegationFilterId);
  const selectedAntennes = activeAntenneId && ANTENNES_BY_DELEGATION[delegationFilterId || '']
    ? ANTENNES_BY_DELEGATION[delegationFilterId || ''].find(a => a.id === activeAntenneId)
    : null;

  const currentFolder = folders.find(fd => fd.id === currentFolderId);

  // Compteurs d'éléments en attente de validation, affichés en badge sur les cards du hub.
  const pendingFilesCount = files.filter(f => f.submissionStatus === 'Pending').length;
  const pendingOrgsCount = orgProfiles.filter(o => o.submissionStatus === 'Pending').length;

  // Liste plate de toutes les antennes (toutes délégations) pour la gestion des groupes.
  const allAntennesFlat: { id: string; name: string }[] = Object.values(ANTENNES_BY_DELEGATION)
    .flat()
    .map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }));

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
              <span>Portail de Coordination Nationale</span>
              <span className="text-[10px] bg-azur-light text-azur border border-azur/15 font-mono tracking-wider uppercase px-1.5 py-0.5 rounded font-black">Admin</span>
            </h1>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-400">
              Aviation Sans Frontières France — Pilotage des délégations et autorisations de vol.
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
          <div className="max-w-4xl mx-auto space-y-8 py-8">
            {/* Elegant Welcome Info Banner */}
            <div className="text-center space-y-2.5">
              <h2 className="text-2xl font-black font-display text-deep dark:text-white tracking-tight">
                Cabinet de Pilotage National
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto font-semibold">
                Bienvenue sur l'outil de coordination et de contrôle de conformité aéronautique d'Aviation Sans Frontières.
              </p>
            </div>

            {/* Hub Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
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
                    <p className="text-xs text-slate-500 dark:text-slate-405 leading-relaxed font-semibold">
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
                    <p className="text-xs text-slate-500 dark:text-slate-405 leading-relaxed font-semibold">
                      Gerez les habilitations, les permissions des structures affiliees, et attribuez les accreditations de coordinateurs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-orange-500 uppercase tracking-wider group-hover:translate-x-1 transition-transform mt-4">
                  <span>Gérer les accès</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {/* Card 3: Implantations / Stations */}
              <button
                onClick={() => {
                  setNavigationView('implantations');
                  setActiveTab('delegations');
                  setCurrentFolderId(null);
                }}
                className="group bg-white dark:bg-slate-900 border border-slate-200/85 hover:border-amber-550 rounded-3xl p-6 text-left shadow-xs hover:shadow-lg transition-all flex flex-col justify-between h-72 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-550 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    📍
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-deep dark:text-white tracking-tight group-hover:text-amber-550 transition-colors flex items-center gap-1.5">
                      <span>Gestion des Implantations</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-405 leading-relaxed font-semibold">
                      Cartographiez les antennes nationales d'initiations sur la carte interactive de France et configurez de nouveaux relais.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-550 uppercase tracking-wider group-hover:translate-x-1 transition-transform mt-4">
                  <span>Configurer l'implantation</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

            </div>

            {/* Quick overview metric line */}
            <div className="bg-slate-50 dark:bg-slate-950/40 p-4 border border-slate-100 dark:border-slate-850 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold">
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

        {/* --- SCENARIO A: PARIS SUPER ADMIN GLOBAL HQ OVERVIEW --- */}
        {navigationView === 'ailes' && isSuperAdminMode && !activeDelegationId && (
          <div className="space-y-6">
            {/* National Supervisor Card */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
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
        {navigationView !== 'hub' && activeDelegationId && (() => {
          const themeAttr = DELEGATION_THEMES[delegationFilterId] || DELEGATION_THEMES['ouest'];
          return (
            <div className="space-y-6">
              
              {/* Back breadcrumb navigation to Admin Hub */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                <button
                  onClick={() => {
                    setNavigationView('hub');
                    setCurrentFolderId(null);
                  }}
                  className={`flex items-center gap-2 text-xs font-black px-4.5 py-2.5 rounded-2xl transition-all cursor-pointer border ${themeAttr.badgeClass} hover:bg-slate-150 dark:hover:bg-slate-800 shadow-xs`}
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" /> <span>← Retour au Hub Principal</span>
                </button>

                <div className="text-[10px] uppercase font-mono font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-2 bg-slate-50 dark:bg-slate-905 border border-slate-200/80 dark:border-slate-800 px-3.5 py-2 rounded-2xl shadow-xs">
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
                      <span className="text-2xl select-none">{themeAttr.icon}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9.5px] tracking-widest font-black uppercase px-2.5 py-1 rounded-lg border leading-none ${themeAttr.badgeClass}`}>
                          Espace de travail régional
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-805 px-2 py-0.5 rounded-lg">
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
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Sélectionner l'Antenne Régionale (Villes actives) :</span>
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
                                ? `bg-white dark:bg-slate-900 ${themeAttr.accentText} border-slate-350 dark:border-slate-700 shadow-xs font-black`
                                : 'bg-white/40 dark:bg-slate-950/20 text-slate-550 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60'
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
                          <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                              Dossiers des Organismes Partenaires ({selectedAntennes?.name})
                            </h3>
                            <p className="text-xs text-slate-455 mt-1 leading-relaxed">
                              Répertoires d'archivage réglementaires pour les compagnies et associations partenaires locales.
                            </p>
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
                          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Rechercher un dossier d'organisme..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 text-xs border rounded-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 ${themeAttr.ringColor}`}
                          />
                        </div>

                        {filteredFolders.length === 0 ? (
                          <div className="border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-3xs">
                            <FolderIcon className="w-12 h-12 text-slate-350 bg-slate-50 dark:bg-slate-855 p-3 rounded-full" />
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Aucun Organisme créé</h4>
                              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 max-w-md">
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
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-slate-850 dark:group-hover:text-slate-100 transition-colors truncate">
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
                        <ChevronRight className="w-4 h-4 text-slate-350" />
                        <span className={`text-xs px-2.5 py-1 rounded-lg border font-black uppercase max-w-[140px] truncate ${themeAttr.badgeClass}`}>
                          📍 {selectedAntennes?.name}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-350" />
                        <h4 className="text-sm font-black text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-800 pl-2">
                          📂 {currentFolder?.name}
                        </h4>
                      </div>

                      {/* Drop File Input buttons */}
                      <div className="flex items-center gap-2">
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
                          type="text"
                          placeholder="Rechercher un fichier de vol..."
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
                                : 'text-slate-500 hover:text-slate-805'
                            }`}
                          >
                            Tous
                          </button>
                          <button
                            onClick={() => setFileTypeFilter('pdfs')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              fileTypeFilter === 'pdfs' 
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs font-black' 
                                : 'text-slate-500 hover:text-slate-805'
                            }`}
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => setFileTypeFilter('images')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              fileTypeFilter === 'images' 
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs font-black' 
                                : 'text-slate-500 hover:text-slate-805'
                            }`}
                          >
                            Images
                          </button>
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
                        <div className="w-full bg-slate-205 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
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
                      <div className="py-12 text-center text-slate-450 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 rounded-3xl flex flex-col items-center justify-center space-y-4">
                        <FileText className="w-12 h-12 text-slate-300" />
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Dossier vide</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                            Aucun document réglementaire n'est présent dans ce dossier d'organisme pour l'instant. Utilisez le bouton ci-dessus pour verser un justificatif.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-wider border-b bg-slate-50 text-slate-500">
                              <th className="px-5 py-3">Document de vol</th>
                              <th className="px-5 py-3 w-40">Taille & Format</th>
                              <th className="px-5 py-3 w-44">Date de dépôt</th>
                              <th className="px-5 py-3 w-52">Statut de validation</th>
                              <th className="px-5 py-3 text-right w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-slate-700 text-xs">
                            {filteredFiles.map((file) => {
                              const activeStatus = file.submissionStatus || 'Pending';
                              const uploaderPartner = orgProfiles.find(p => p.id === file.orgId);
                              const uploaderName = file.uploadedBy === 'admin' ? 'admin' : (uploaderPartner?.name || 'Organisme');
                              return (
                                <tr key={file.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setPreviewingFile(file)}>
                                  
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
                                          <span className="text-[9.5px] text-slate-450 font-mono tracking-wider">ID : {file.id.substring(0, 8)}</span>
                                          <span className="text-[9px] text-slate-300">•</span>
                                          <span className="text-[10px] text-slate-550 font-medium flex items-center gap-1">
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
                  <h3 className="text-sm font-black text-deep flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-azur" />
                    <span>Gestionnaire d'Accréditations de la Délégation</span>
                  </h3>
                  <p className="text-xs text-slate-650 leading-relaxed font-semibold">
                    Les compagnies et associations partenaires d'Aviation Sans Frontières s'enregistrent ici. En tant que coordinateur d'Aviation Sans Frontières pour la région <strong>{selectedDelegationData?.name}</strong>, vous devez affecter une antenne locale de rattachement à chaque organisme candidat et approuver officiellement sa connexion pour activer son droit de dépôt réglementaire.
                  </p>
                </div>

                <div className="space-y-6">
                  
                  {/* Category 1: Regional Members */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        Comptes Partenaires enregistrés sous la délégation : {selectedDelegationData?.name}
                      </h4>
                      <p className="text-xs text-slate-450 mt-1">
                        Utilisateurs ayant formulé leur inscription ou rattachés à votre section de vol régionale.
                      </p>
                    </div>

                    {orgProfiles.filter(p => p.delegation_id === delegationFilterId).length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        Aucun partenaire enregistré sous cette délégation actuellement.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[10px] font-black uppercase tracking-wider border-b bg-slate-50 text-slate-550">
                              <th className="px-5 py-3">Raison Sociale / Organisme</th>
                              <th className="px-5 py-3">Point de contact</th>
                              <th className="px-5 py-3 w-64">Attribution Régionale</th>
                              <th className="px-5 py-3 w-40">Statut d'Accès</th>
                              <th className="px-5 py-3 text-right">Décision d'Accréditation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-slate-700 text-xs">
                            {orgProfiles.filter(p => p.delegation_id === delegationFilterId).map((org) => {
                              const st = org.submissionStatus || 'Pending';
                              return (
                                <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                                  
                                  <td className="px-5 py-4 font-bold text-slate-900">
                                    <p className="font-extrabold text-slate-900">{org.name || "Néant"}</p>
                                    <p className="text-[9.5px] text-slate-400 font-mono">UID : {org.id.substring(0, 10)}</p>
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
                                    <p className="font-bold text-slate-805">{org.contactName}</p>
                                    <p className="text-[11px] text-azur font-semibold">{org.email}</p>
                                    <p className="text-[11.5px] text-slate-500 font-mono">{org.phone}</p>
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
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-808"
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
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-808 disabled:opacity-50"
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
                                        <p className="text-[11.5px] text-slate-450 font-semibold font-mono">
                                          📍 {org.antenne_id ? (ANTENNES_BY_DELEGATION[org.delegation_id || '']?.find(a => a.id === org.antenne_id)?.name || org.antenne_id) : "Non affecté"}
                                        </p>
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
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-5 py-4">
                                    <StatusBadge status={st} />
                                  </td>

                                  <td className="px-5 py-4 text-right">
                                    <div className="flex justify-end gap-1.5">
                                      {org.submissionStatus !== 'Validated' && (
                                        <button
                                          onClick={() => handleUpdateOrgStatus(org.id, 'Validated')}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11.5px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs"
                                        >
                                          ✓ Approuver
                                        </button>
                                      )}

                                      {org.submissionStatus === 'Validated' && (
                                        <button
                                          onClick={() => handleUpdateOrgStatus(org.id, 'Incomplete')}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-800 font-extrabold border border-rose-250 text-[11.5px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all"
                                        >
                                          ✗ Suspendre
                                        </button>
                                      )}

                                      {org.submissionStatus === 'Pending' && (
                                        <button
                                          onClick={() => handleUpdateOrgStatus(org.id, 'Under review')}
                                          className="bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold border border-blue-200 text-[11.5px] px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                                        >
                                          Mettre en examen
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

                  {/* Category 2: Orphan Accounts waitlist */}
                  <div className="bg-amber-500/5 border border-amber-200/40 rounded-3xl p-6 shadow-xs space-y-4">
                    <div>
                      <h4 className="text-sm font-black text-amber-955 flex items-center gap-1.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />
                        <span>Candidatures Hors Délégation (Comptes orphelins à lier à une antenne)</span>
                      </h4>
                      <p className="text-xs text-amber-900 font-semibold leading-relaxed">
                        Ces candidats se sont enregistrés en ligne mais leur profil n'est affecté à aucun bureau. En tant que coordinateur, vous pouvez adopter leur compte dans votre délégation, leur attribuer une ville et leur donner un accès direct.
                      </p>
                    </div>

                    {orgProfiles.filter(p => !p.delegation_id || p.delegation_id === '').length === 0 ? (
                      <div className="py-8 text-center text-xs text-amber-705 font-semibold italic">
                        ✓ Aucune candidature orpheline nationale en suspens.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-amber-200 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-wider border-b bg-amber-50 text-amber-800">
                              <th className="px-5 py-3">Adresse de connexion</th>
                              <th className="px-5 py-3">Profil renseigné</th>
                              <th className="px-5 py-3 w-64">Attribution Interne</th>
                              <th className="px-5 py-3 text-right font-black">Action d'Accréditation d'urgence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-slate-700 text-xs">
                            {orgProfiles.filter(p => !p.delegation_id || p.delegation_id === '').map((org) => {
                              return (
                                <tr key={org.id} className="hover:bg-amber-50/10 transition-all">
                                  
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
                                          <label className="text-[9.5px] uppercase tracking-wider text-slate-450 font-black block">Délégation d'accueil</label>
                                          <select
                                            value={editDelegation}
                                            onChange={(e) => {
                                              setEditDelegation(e.target.value);
                                              setEditAntenne('');
                                            }}
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-808"
                                          >
                                            <option value="">Sélectionner...</option>
                                            {DELEGATIONS.map(del => (
                                              <option key={del.id} value={del.id}>{del.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="text-[9.5px] uppercase tracking-wider text-slate-450 font-black block">Antenne locale / Ville</label>
                                          <select
                                            value={editAntenne}
                                            onChange={(e) => setEditAntenne(e.target.value)}
                                            disabled={!editDelegation}
                                            className="text-xs p-1.5 border rounded-lg w-full bg-white font-bold text-slate-808 disabled:opacity-50"
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
                                        <span className="text-[10px] bg-amber-100 text-amber-805 font-extrabold px-2.5 py-1 rounded-full block text-center max-w-[140px]">
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
                </div>
              </div>
            )}

            {activeTab === 'delegations' && (
              <div className="space-y-6 text-left">
                {/* Visual Sky Banner */}
                <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/60 p-5 text-left space-y-2 rounded-2xl">
                  <h3 className="text-sm font-extrabold text-sky-900 dark:text-sky-305 flex items-center gap-2">
                    <Compass className="w-5 h-5 text-sky-600 dark:text-sky-400 animate-spin" />
                    <span>Réseau National Aviation Sans Frontières (Carte Interactive de France)</span>
                  </h3>
                  <p className="text-xs text-sky-700 dark:text-sky-400 leading-relaxed font-medium">
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
                    <div className="w-full bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-150 dark:border-slate-800/80 p-4 flex items-center justify-center relative overflow-hidden group">
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
                        <g className="stroke-slate-150/40 dark:stroke-slate-800/20 stroke-[0.5]" pointerEvents="none">
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

                        {/* Beautiful stylized silhouette of France */}
                        <path
                          d="M 330,20 
                             C 345,15 365,10 380,25
                             C 400,45 420,50 440,65
                             C 460,80 480,95 500,105
                             C 520,115 540,115 550,140
                             C 560,165 545,190 535,215
                             C 525,240 515,265 510,290
                             C 505,315 520,340 540,365
                             C 560,390 550,410 535,430
                             C 520,450 510,470 490,490
                             C 470,510 445,530 425,545
                             C 405,560 380,575 355,580
                             C 330,585 305,570 280,560
                             C 255,550 230,540 205,535
                             C 180,530 150,545 125,540
                             C 100,535 85,515 80,490
                             C 75,465 70,445 60,420
                             C 50,395 30,370 20,345
                             C 10,320 25,295 40,270
                             C 55,245 45,220 30,195
                             C 15,170 30,150 45,135
                             C 60,120 80,130 100,125
                             C 120,120 140,100 160,95
                             C 180,90 200,105 220,100
                             C 240,95 260,80 275,65
                             C 290,50 315,25 330,20 Z"
                          className="fill-sky-50 dark:fill-slate-800/20 stroke-sky-200 dark:stroke-slate-750 stroke-2 outline-none transition-colors duration-300"
                        />

                        {/* Captions representing oceanic borders */}
                        <text x="140" y="80" className="fill-slate-405/60 dark:fill-slate-600/40 text-[10px] font-bold tracking-widest pointer-events-none uppercase font-sans">La Manche</text>
                        <text x="50" y="440" className="fill-slate-405/60 dark:fill-slate-600/40 text-[10px] font-bold tracking-widest pointer-events-none uppercase font-sans">Océan Atlantique</text>
                        <text x="440" y="550" className="fill-slate-400/60 dark:fill-slate-600/40 text-[10px] font-bold tracking-widest pointer-events-none uppercase font-sans">Mer Méditerranée</text>

                        {/* Corsica Map Accent */}
                        <path
                          d="M 505,480
                             C 510,475 515,480 520,485
                             C 525,490 520,505 515,515
                             C 510,525 505,530 500,525
                             C 495,520 497,490 505,480
                             Z"
                          className="fill-sky-50 dark:fill-slate-800/20 stroke-sky-200 dark:stroke-slate-750 stroke-2 transition-all duration-350"
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
                                    : "fill-sky-400/20 group-hover/pin:fill-sky-400/40 stroke-sky-400 stroke-[1.5]"
                                } transition-all duration-305 pointer-events-none`}
                              />
                              <circle
                                cx={x * 6}
                                cy={y * 6}
                                r={isCurrentlySelected ? "6" : "4"}
                                className={`${
                                  isCurrentlySelected 
                                    ? "fill-amber-500 stroke-dark" 
                                    : "fill-sky-500 stroke-white dark:stroke-slate-900 stroke-2"
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

                    {/* Pre-set Quick Buttons for towns */}
                    <div className="w-full bg-slate-50 dark:bg-slate-950/20 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left flex items-center gap-1">
                        <span>📍 Villes de Présélection Express :</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-start">
                        {[
                          { name: "Paris", x: 50.8, y: 22.5 },
                          { name: "Lille", x: 53.5, y: 5.5 },
                          { name: "Lyon", x: 63.2, y: 51.5 },
                          { name: "Marseille", x: 65.5, y: 81.0 },
                          { name: "Toulouse", x: 39.5, y: 81.5 },
                          { name: "Nantes", x: 23.0, y: 38.0 },
                          { name: "Strasbourg", x: 82.5, y: 23.0 },
                          { name: "Bordeaux", x: 28.0, y: 64.0 },
                          { name: "Brest", x: 4.0, y: 22.0 }
                        ].map((city) => (
                          <button
                            key={city.name}
                            type="button"
                            onClick={() => {
                              if (editingAntenne) {
                                setEditingAntenne(prev => prev ? { ...prev, name: city.name, x: city.x, y: city.y } : null);
                              } else {
                                setNewAntenneName(city.name);
                                const slug = city.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                                setNewAntenneId(slug);
                                setTempCoords({ x: city.x, y: city.y });
                              }
                            }}
                            className="text-[10px] bg-sky-50 dark:bg-sky-950/40 border border-sky-100/80 dark:border-sky-900/40 hover:border-sky-300 hover:bg-sky-100 text-sky-700 dark:text-sky-300 px-2 py-1 rounded-lg font-bold transition-all cursor-pointer shadow-xs"
                          >
                            + {city.name}
                          </button>
                        ))}
                      </div>
                    </div>
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
                                <span className="font-mono text-amber-600 dark:text-amber-455">{editingAntenne.x}%</span>
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
                                <span className="font-mono text-amber-600 dark:text-amber-455">{editingAntenne.y}%</span>
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

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                              Nom à Afficher sur la Carte
                            </label>
                            <input
                              type="text"
                              required
                              value={editingAntenne.name}
                              onChange={(e) => setEditingAntenne(prev => prev ? { ...prev, name: e.target.value } : null)}
                              className="w-full mt-1 px-3 py-2 border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 focus:outline-none font-bold"
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
                              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl text-xs transition duration-150 cursor-pointer"
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
                                className="w-full mt-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-750 dark:text-slate-400 rounded-xl text-xs font-mono"
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
                                className="w-full mt-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-750 dark:text-slate-400 rounded-xl text-xs font-mono"
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
                              className="w-full mt-1 px-3 py-2 border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-sky-505/20 focus:border-sky-500 focus:outline-none font-bold"
                            />
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
                            className="w-full py-2.5 px-4 bg-azur hover:bg-azur-hover text-white font-black rounded-xl text-xs transition duration-150 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
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
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Gestion des Antennes Actives ({ (ANTENNES_BY_DELEGATION['france'] || []).length })
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Consultez la liste des antennes locales rattachées à l'infrastructure nationale d'Aviation Sans Frontières.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(ANTENNES_BY_DELEGATION['france'] || []).map((ant) => {
                      const countFolders = folders.filter(fol => fol.antenne_id === ant.id).length;
                      const hasCoordinators = orgProfiles.filter(p => p.antenne_id === ant.id).length;
                      const isCurrentlySel = editingAntenne?.id === ant.id;
                      return (
                        <div
                          key={ant.id}
                          className={`flex justify-between items-center p-4 rounded-2xl border transition-all duration-200 ${
                            isCurrentlySel 
                              ? "bg-amber-500/5 dark:bg-amber-505/2 border-amber-500/40 shadow-xs ring-1 ring-amber-500/10" 
                              : "bg-slate-50/50 dark:bg-slate-950/20 border-slate-150 dark:border-slate-800 hover:border-sky-500/40"
                          }`}
                        >
                          <div className="space-y-1 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAntenne({
                                  id: ant.id,
                                  name: ant.name,
                                  x: ant.x !== undefined ? ant.x : 50,
                                  y: ant.y !== undefined ? ant.y : 50
                                });
                                setTempCoords(null);
                              }}
                              className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 hover:text-sky-600 dark:hover:text-sky-400 transition-colors text-left"
                            >
                              <span className={`w-2 h-2 rounded-full ${isCurrentlySel ? 'bg-amber-500 animate-ping' : 'bg-sky-500'}`}></span>
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
                              onClick={() => {
                                setEditingAntenne({
                                  id: ant.id,
                                  name: ant.name,
                                  x: ant.x !== undefined ? ant.x : 50,
                                  y: ant.y !== undefined ? ant.y : 50
                                });
                                setTempCoords(null);
                              }}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isCurrentlySel 
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" 
                                  : "hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-600 border-transparent hover:border-sky-100 dark:hover:border-sky-900/40"
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
                    })}
                  </div>
                </div>

                {isSuperAdminMode && (
                  <AntenneGroupsManager groups={antenneGroups} antennes={allAntennesFlat} />
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
