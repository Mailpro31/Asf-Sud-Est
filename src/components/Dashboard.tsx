import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes } from '../lib/utils';
import { 
  ShieldAlert, 
  CloudUpload, 
  FileText, 
  Trash2, 
  LogOut,
  AlertCircle,
  RefreshCw, 
  Edit2, 
  FolderPlus, 
  Folder as FolderIcon, 
  ChevronRight, 
  CornerLeftUp, 
  Download,
  Sliders,
  Sparkles,
  Search,
  Check,
  User,
  HardDrive,
  Settings,
  GraduationCap,
  AlertTriangle,
  Clock,
  MessageSquare,
  Send,
  ArrowRight,
  Upload,
  X,
  Menu,
  Plane,
  Phone,
  Mail,
  MapPin,
  Building2,
  Info,
  ChevronDown,
  CalendarClock
} from 'lucide-react';
import { collection, query, where, onSnapshot, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFeedback } from '../hooks/useFeedback';
import { DossierFile, SubmissionStatus, Folder } from '../types';
import DeleteConfirmModal from './DeleteConfirmModal';
import FilePreviewModal from './FilePreviewModal';
import CreateFolderModal from './CreateFolderModal';
import UserProfileModal from './UserProfileModal';
import { LogoASF } from './LandingPage';
import { localDb } from '../lib/localDb';
import { notifyAntenneOnUpload, notifyAntenneOnSubmission, subscribeAntenneSettings, type AntenneSettings } from '../lib/antenneSettings';
import { logAction } from '../lib/auditLog';
import { downloadFile, deleteFileArtifacts } from '../lib/fileTransfer';
import { sweepExpired, expiryInfo, formatExpiryDate, isExpired, expiryIconClass } from '../lib/expiry';
import { firebaseConfig } from '../lib/firebaseConfig';
import { StatusBadge, GuidedTour, StatusFilterChips, ThemeToggle, NotificationBell, ExpiryBadge, type NotificationItem, type TourStep } from './ui';
import { useCmdK } from '../hooks/useCmdK';
import { useFirstRunTour } from '../hooks/useFirstRunTour';


export default function Dashboard() {
  const { user, organization, signOut, antennes, delegations } = useAuth();
  const { themeConfig } = useTheme();
  const { toast } = useFeedback();

  const getDelegationName = (id: string) =>
    delegations.find(d => d.id === id)?.name || id;

  const getAntenneName = (delId: string, antId: string) => {
    const list = antennes[delId || 'france'] || [];
    return list.find(a => a.id === antId)?.name || antId;
  };
  
  const [files, setFiles] = useState<DossierFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [isWarningDismissed, setIsWarningDismissed] = useState(() => localStorage.getItem('asf_sandbox_warn_dismissed') === 'true');
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  // Profil (lecture seule) de l'antenne de rattachement, renseigné par le
  // gestionnaire d'antenne. Visible par tous ses membres.
  const [antenneInfo, setAntenneInfo] = useState<AntenneSettings | null>(null);
  const [showAntenneInfo, setShowAntenneInfo] = useState(true);
  const antenneCardRef = useRef<HTMLDivElement | null>(null);
  // Déplie la carte « Votre antenne » et y fait défiler la page.
  const revealAntenneInfo = useCallback(() => {
    setShowAntenneInfo(true);
    setIsMobileDrawerOpen(false);
    requestAnimationFrame(() => {
      antenneCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const refreshLocalState = useCallback(() => {
    if (!user || !organization) return;
    const userDelegationId = organization.delegation_id;
    const userAntenneId = organization?.antenne_id;

    const localFiles = localDb.getFiles();
    const ownFiles = localFiles.filter(f => f.orgId === user.uid);
    const adminFilesCreated = localFiles.filter(f => f.delegation_id === userDelegationId && f.orgId === 'admin_created');
    const adminFilesPublic = localFiles.filter(f => f.delegation_id === userDelegationId && f.orgId === 'public');
    
    const combinedFiles = [...ownFiles];
    const seenFileIds = new Set(combinedFiles.map(f => f.id));
    for (const f of [...adminFilesCreated, ...adminFilesPublic]) {
      if (!seenFileIds.has(f.id)) {
        combinedFiles.push(f);
        seenFileIds.add(f.id);
      }
    }
    let finalFiles = combinedFiles.filter(f => {
      if (f.uploadedBy === 'admin') {
        // Un fichier déposé par un coordinateur est visible par le partenaire
        // sauf s'il a été explicitement marqué « Privé Coordinateur ».
        // Le statut de validation (En attente / Validé) ne masque pas le fichier.
        return (f as any).sharedWithPartner !== false;
      }
      return true;
    });
    if (userAntenneId) {
      finalFiles = finalFiles.filter(f => !f.antenne_id || f.antenne_id === '' || f.antenne_id === userAntenneId);
    }
    finalFiles.sort((a, b) => b.uploadDate - a.uploadDate);
    setFiles(finalFiles);

    const localFolders = localDb.getFolders();
    const ownFolders = localFolders.filter(f => f.orgId === user.uid);
    const adminFoldersCreated = localFolders.filter(f => f.delegation_id === userDelegationId && f.orgId === 'admin_created');
    const adminFoldersPublic = localFolders.filter(f => f.delegation_id === userDelegationId && f.orgId === 'public');

    const combinedFolders = [...ownFolders];
    const seenFolderIds = new Set(combinedFolders.map(f => f.id));
    for (const f of [...adminFoldersCreated, ...adminFoldersPublic]) {
      if (!seenFolderIds.has(f.id)) {
        combinedFolders.push(f);
        seenFolderIds.add(f.id);
      }
    }
    let finalFolders = combinedFolders;
    if (userAntenneId) {
      finalFolders = combinedFolders.filter(f => !f.antenne_id || f.antenne_id === '' || f.antenne_id === userAntenneId);
    }
    finalFolders.sort((a, b) => b.createdAt - a.createdAt);
    setFolders(finalFolders);
  }, [user, organization]);

  useEffect(() => {
    if (!user || !organization) return;
    
    const userDelegationId = organization.delegation_id;
    const userAntenneId = organization?.antenne_id;
    
    let ownFiles: DossierFile[] = [];
    let adminFilesCreated: DossierFile[] = [];
    let adminFilesPublic: DossierFile[] = [];
    
    const updateCombinedFiles = () => {
      const combined = [...ownFiles];
      const seenIds = new Set(combined.map(f => f.id));
      
      const addUniqueFiles = (arr: DossierFile[]) => {
        for (const file of arr) {
          if (!seenIds.has(file.id)) {
            combined.push(file);
            seenIds.add(file.id);
          }
        }
      };
      
      addUniqueFiles(adminFilesCreated);
      addUniqueFiles(adminFilesPublic);
      
      let finalFiles = combined.filter(f => {
        if (f.uploadedBy === 'admin') {
          // Un fichier déposé par un coordinateur est visible par le partenaire
          // sauf s'il a été explicitement marqué « Privé Coordinateur ».
          // Le statut de validation (En attente / Validé) ne masque pas le fichier.
          return (f as any).sharedWithPartner !== false;
        }
        return true;
      });

      if (userAntenneId) {
        finalFiles = finalFiles.filter(f => !f.antenne_id || f.antenne_id === '' || f.antenne_id === userAntenneId);
      }
      
      finalFiles.sort((a, b) => b.uploadDate - a.uploadDate);
      setFiles(finalFiles);
    };

    let ownFolders: Folder[] = [];
    let adminFoldersCreated: Folder[] = [];
    let adminFoldersPublic: Folder[] = [];

    const updateCombinedFolders = () => {
      const combined = [...ownFolders];
      const seenIds = new Set(combined.map(f => f.id));
      
      const addUniqueFolders = (arr: Folder[]) => {
        for (const f of arr) {
          if (!seenIds.has(f.id)) {
            combined.push(f);
            seenIds.add(f.id);
          }
        }
      };
      
      addUniqueFolders(adminFoldersCreated);
      addUniqueFolders(adminFoldersPublic);
      
      let finalFolders = combined;
      if (userAntenneId) {
        finalFolders = combined.filter(f => !f.antenne_id || f.antenne_id === '' || f.antenne_id === userAntenneId);
      }
      
      finalFolders.sort((a, b) => b.createdAt - a.createdAt);
      setFolders(finalFolders);
    };

    const handleSandboxCrash = (err: any) => {
      // On ne bascule en mode local QUE si Firestore est réellement injoignable
      // (perte de connexion). Une erreur de permission ne doit PAS faire basculer
      // toute l'app en local (sinon le bandeau orange apparaît à tort) : on la
      // journalise simplement.
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
        console.warn("Firestore injoignable dans Dashboard. Bascule en sauvegarde locale :", err);
        localDb.setSandboxActive(true);
        refreshLocalState();
      } else {
        console.warn("Erreur Firestore (non bloquante) dans Dashboard, pas de bascule locale :", err);
      }
    };

    if (localDb.isSandboxActive()) {
      refreshLocalState();
      
      const handleLocalDbUpdate = () => {
        refreshLocalState();
      };
      
      window.addEventListener('localdb-update', handleLocalDbUpdate);
      return () => {
        window.removeEventListener('localdb-update', handleLocalDbUpdate);
      };
    }

    let unsubOwnFiles = () => {};
    let unsubAdminFilesCreated = () => {};
    let unsubAdminFilesPublic = () => {};
    let unsubOwnFolders = () => {};
    let unsubAdminFoldersCreated = () => {};
    let unsubAdminFoldersPublic = () => {};

    try {
      const qOwnFiles = query(collection(db, 'files'), where('orgId', '==', user.uid));
      unsubOwnFiles = onSnapshot(qOwnFiles, (snapshot) => {
        ownFiles = [];
        snapshot.forEach((doc) => {
          ownFiles.push({ id: doc.id, ...doc.data() } as DossierFile);
        });
        updateCombinedFiles();
      }, handleSandboxCrash);

      if (userDelegationId) {
        const qAdminFilesCreated = query(
          collection(db, 'files'), 
          where('delegation_id', '==', userDelegationId), 
          where('orgId', '==', 'admin_created')
        );
        unsubAdminFilesCreated = onSnapshot(qAdminFilesCreated, (snapshot) => {
          adminFilesCreated = [];
          snapshot.forEach((doc) => {
            adminFilesCreated.push({ id: doc.id, ...doc.data() } as DossierFile);
          });
          updateCombinedFiles();
        }, handleSandboxCrash);

        const qAdminFilesPublic = query(
          collection(db, 'files'), 
          where('delegation_id', '==', userDelegationId), 
          where('orgId', '==', 'public')
        );
        unsubAdminFilesPublic = onSnapshot(qAdminFilesPublic, (snapshot) => {
          adminFilesPublic = [];
          snapshot.forEach((doc) => {
            adminFilesPublic.push({ id: doc.id, ...doc.data() } as DossierFile);
          });
          updateCombinedFiles();
        }, handleSandboxCrash);
      }

      const qOwnFolders = query(collection(db, 'folders'), where('orgId', '==', user.uid));
      unsubOwnFolders = onSnapshot(qOwnFolders, (snapshot) => {
        ownFolders = [];
        snapshot.forEach((doc) => {
          ownFolders.push({ id: doc.id, ...doc.data() } as Folder);
        });
        updateCombinedFolders();
      }, handleSandboxCrash);

      if (userDelegationId) {
        const qAdminFoldersCreated = query(
          collection(db, 'folders'), 
          where('delegation_id', '==', userDelegationId), 
          where('orgId', '==', 'admin_created')
        );
        unsubAdminFoldersCreated = onSnapshot(qAdminFoldersCreated, (snapshot) => {
          adminFoldersCreated = [];
          snapshot.forEach((doc) => {
            adminFoldersCreated.push({ id: doc.id, ...doc.data() } as Folder);
          });
          updateCombinedFolders();
        }, handleSandboxCrash);

        const qAdminFoldersPublic = query(
          collection(db, 'folders'), 
          where('delegation_id', '==', userDelegationId), 
          where('orgId', '==', 'public')
        );
        unsubAdminFoldersPublic = onSnapshot(qAdminFoldersPublic, (snapshot) => {
          adminFoldersPublic = [];
          snapshot.forEach((doc) => {
            adminFoldersPublic.push({ id: doc.id, ...doc.data() } as Folder);
          });
          updateCombinedFolders();
        }, handleSandboxCrash);
      }
    } catch (err) {
      handleSandboxCrash(err);
    }

    return () => {
      unsubOwnFiles();
      unsubAdminFilesCreated();
      unsubAdminFilesPublic();
      unsubOwnFolders();
      unsubAdminFoldersCreated();
      unsubAdminFoldersPublic();
    };
  }, [user, organization, refreshLocalState]);

  // Abonnement au profil de l'antenne de rattachement (lecture seule pour le
  // membre). Les valeurs sont renseignées par le gestionnaire de l'antenne.
  useEffect(() => {
    const antId = organization?.antenne_id;
    if (!antId) {
      setAntenneInfo(null);
      return;
    }
    const unsub = subscribeAntenneSettings(antId, setAntenneInfo);
    return () => unsub();
  }, [organization?.antenne_id]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;
    if (organization?.submissionStatus !== 'Validated') {
      const msg = organization?.submissionStatus === 'Incomplete'
        ? "Votre compte est suspendu : l'envoi de fichiers est désactivé. Contactez votre coordinateur ASF."
        : "Votre compte est en attente de validation. Un coordinateur ASF doit approuver votre accès avant que vous puissiez déposer des fichiers.";
      toast(msg, 'warning');
      return;
    }
    setUploading(true);
    setStorageWarning(null);

    if (localDb.isSandboxActive()) {
      let count = 0;
      for (const file of acceptedFiles) {
        try {
          const fallbackDataUrl = await new Promise<string>((resolveRead, rejectRead) => {
            const reader = new FileReader();
            reader.onload = () => resolveRead(reader.result as string);
            reader.onerror = () => rejectRead(reader.error);
            reader.readAsDataURL(file);
          });
          const now = Date.now();
          localDb.saveFile({
            id: 'local_file_' + Date.now() + '_' + Math.random().toString(36).substring(5),
            orgId: user.uid,
            folderId: currentFolderId || null,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            storagePath: 'firestore_fallback',
            fallbackDataUrl: fallbackDataUrl,
            uploadDate: now,
            uploadedBy: 'user',
            delegation_id: organization?.delegation_id || '',
            antenne_id: organization?.antenne_id || '',
            submissionStatus: 'Pending',
          });
          count++;
        } catch (e) {
          console.error("Local save error", e);
        }
      }
      setUploading(false);
      refreshLocalState();
      if (count > 0) {
        toast(`${count} fichier(s) enregistré(s) ✓`, 'success');
        const antName = (antennes[organization?.delegation_id || ''] || []).find(a => a.id === organization?.antenne_id)?.name;
        notifyAntenneOnUpload(
          organization?.antenne_id,
          'file',
          count > 1 ? `${count} fichiers` : acceptedFiles[0]?.name || 'fichier',
          { partnerName: organization?.name, antenneName: antName },
        );
      }
      return;
    }
    
    let hasStorageError = false;
    let fallbackCount = 0;
    
    for (const file of acceptedFiles) {
      const fileExt = file.name.split('.').pop() || '';
      const storagePath = `dossiers/${user.uid}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storageRef = ref(storage, storagePath);
      
      try {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.min(progress, 100));
            },
            (error) => reject(error),
            async () => {
              try {
                const now = Date.now();
                await addDoc(collection(db, 'files'), {
                  orgId: user.uid,
                  folderId: currentFolderId,
                  name: file.name,
                  size: file.size,
                  type: file.type || 'application/octet-stream',
                  storagePath: storagePath,
                  uploadDate: now,
                  uploadedBy: 'user',
                  delegation_id: organization?.delegation_id || '',
                  antenne_id: organization?.antenne_id || '',
                  submissionStatus: 'Pending',
                });
                resolve();
              } catch (e) {
                console.error("Error creating file doc", e);
                reject(e);
              }
            }
          );
        });
      } catch (error: any) {
        console.warn('Primary storage upload failed, attempting sandbox fallback:', error);
        hasStorageError = true;
        
        try {
          const fallbackDataUrl = await new Promise<string>((resolveRead, rejectRead) => {
            const reader = new FileReader();
            reader.onload = () => resolveRead(reader.result as string);
            reader.onerror = () => rejectRead(reader.error);
            reader.readAsDataURL(file);
          });
          
          const now = Date.now();
          if (file.size < 700000) { // < 700KB fits perfectly inside one Firestore doc
            await addDoc(collection(db, 'files'), {
              orgId: user.uid,
              folderId: currentFolderId || null,
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              storagePath: 'firestore_fallback',
              fallbackDataUrl: fallbackDataUrl,
              uploadDate: now,
              uploadedBy: 'user',
              delegation_id: organization?.delegation_id || '',
              antenne_id: organization?.antenne_id || '',
              submissionStatus: 'Pending',
            });
          } else {
            // Chunk fallback for files larger than 700KB
            const fileDocRef = await addDoc(collection(db, 'files'), {
              orgId: user.uid,
              folderId: currentFolderId || null,
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              storagePath: 'firestore_fallback_chunked',
              uploadDate: now,
              uploadedBy: 'user',
              delegation_id: organization?.delegation_id || '',
              antenne_id: organization?.antenne_id || '',
              submissionStatus: 'Pending',
            });

            const chunkSize = 700000;
            let chunkIndex = 0;
            const chunkPromises = [];
            for (let offset = 0; offset < fallbackDataUrl.length; offset += chunkSize) {
              const chunkData = fallbackDataUrl.substring(offset, offset + chunkSize);
              const chunkIdx = chunkIndex;
              chunkPromises.push(
                addDoc(collection(db, 'files', fileDocRef.id, 'chunks'), {
                  index: chunkIdx,
                  data: chunkData,
                })
              );
              chunkIndex++;
            }
            // Wait for all chunks to upload in parallel
            await Promise.all(chunkPromises);
          }
          
          fallbackCount++;
        } catch (fallbackErr) {
          console.error('Fallback upload failed:', fallbackErr);
          toast(`L'envoi de secours a échoué pour : ${file.name}`, 'error');
        }
      }
    }
    
    setUploading(false);
    setUploadProgress(0);
    
    if (hasStorageError) {
      if (fallbackCount > 0) {
        // Le dépôt direct (Storage) a échoué mais l'enregistrement a réussi :
        // simple confirmation discrète, pas d'alerte anxiogène.
        toast(`${fallbackCount} fichier(s) enregistré(s) ✓`, 'success');
      } else {
        toast("L'envoi du fichier a échoué. Réessayez ou vérifiez votre connexion.", 'error');
      }
    }

    // Notifie le gestionnaire de l'antenne (si activé) du nouveau dépôt.
    const okCount = acceptedFiles.length;
    if (okCount > 0) {
      const antName = (antennes[organization?.delegation_id || ''] || []).find(a => a.id === organization?.antenne_id)?.name;
      notifyAntenneOnUpload(
        organization?.antenne_id,
        'file',
        okCount > 1 ? `${okCount} fichiers` : acceptedFiles[0]?.name || 'fichier',
        { partnerName: organization?.name, antenneName: antName },
      );
      // Journal d'activité : une entrée par fichier déposé.
      for (const f of acceptedFiles) {
        logAction('file_upload', { targetType: 'file', targetName: f.name });
      }
    }
  }, [user, currentFolderId, organization, refreshLocalState, antennes]);

  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onDrop(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onDrop(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const [renamingFile, setRenamingFile] = useState<DossierFile | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [previewingFile, setPreviewingFile] = useState<DossierFile | null>(null);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [fileStatusFilter, setFileStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [tourOpen, setTourOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Raccourci clavier ⌘K / Ctrl+K : focus la recherche de documents.
  useCmdK(() => { if (searchInputRef.current) searchInputRef.current.focus(); });

  // Lance automatiquement la visite à la TOUTE première connexion du compte.
  useFirstRunTour(organization, () => setTourOpen(true));

  // Étapes « documents » détaillées sur un exemple concret (1ère ligne) si des
  // fichiers existent, sinon une explication générale de la zone.
  const docSteps: TourStep[] = files.length > 0
    ? [
        { target: '[data-tour="doc-row"]', title: 'Une ligne de document', text: "Prenons votre premier document comme exemple. Cliquez sur la ligne pour le prévisualiser à tout moment." },
        { target: '[data-tour="doc-status"]', title: 'Le statut du document', text: "En attente, en révision, validé ou incomplet : l'état de validation par votre antenne, document par document." },
        { target: '[data-tour="doc-actions"]', title: 'Les actions', text: "Au survol de la ligne : télécharger, renommer ou supprimer le document." },
      ]
    : [
        { target: '[data-tour="docs"]', title: 'Vos documents et dossiers', text: "Vos fichiers apparaîtront ici avec leur statut. Vous pourrez créer des dossiers, les classer, les prévisualiser, les renommer ou les télécharger." },
      ];

  const tourSteps: TourStep[] = [
    { target: '[data-tour="tutoriel"]', title: 'Le bouton Tutoriel', text: "Toujours ici, en haut à droite. Relancez cette visite guidée à tout moment." },
    { target: '[data-tour="status"]', title: "Le statut de votre dossier", text: "Indique où en est votre dossier : en attente, en révision, validé ou incomplet. Tant qu'il n'est pas validé, le dépôt reste bloqué." },
    { target: '[data-tour="folders"]', title: 'Vos dossiers', text: "Créez et ouvrez vos dossiers ici, dans la barre latérale. Le bouton + crée un nouveau dossier ; le chiffre indique le nombre de fichiers qu'il contient." },
    { target: '[data-tour="upload"]', title: 'Déposer vos fichiers', text: "Cliquez sur « Déposer », ou glissez vos documents sur la tuile en pointillés. Ouvrez d'abord un dossier à gauche pour y classer directement vos fichiers." },
    { target: '[data-tour="storage"]', title: 'Votre espace de stockage', text: "Suivez l'espace utilisé sur votre quota, ici dans la barre latérale. La jauge passe au rouge quand vous approchez de la limite." },
    { target: '[data-tour="submit"]', title: 'Soumettre votre dossier', text: "Quand vous estimez que votre dossier est complet, cliquez sur « Soumettre mon dossier » : votre antenne est prévenue sur son tableau de bord et procède à la revue." },
    { target: '[data-tour="filters"]', title: 'Rechercher et filtrer', text: "Retrouvez un document par son nom (raccourci ⌘K / Ctrl+K), ou filtrez par type et par statut." },
    ...docSteps,
    { target: '[data-tour="account"]', title: 'Votre compte', text: "Accédez à vos informations, changez votre mot de passe ou déconnectez-vous depuis votre profil." },
  ];
  const [deletingFile, setDeletingFile] = useState<DossierFile | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  // Un fichier est « expiré » s'il a dépassé sa propre échéance OU celle de son
  // dossier parent. Un document expiré n'est plus consultable (il va être
  // supprimé) : on bloque aperçu et téléchargement à la source.
  const isFileExpired = useCallback(
    (f: DossierFile) => isExpired(f.expiresAt) || (!!f.folderId && isExpired(folders.find((d) => d.id === f.folderId)?.expiresAt)),
    [folders],
  );
  // Ouvre l'aperçu d'un fichier, sauf s'il a expiré (il va être supprimé).
  const openFilePreview = useCallback(
    (f: DossierFile) => {
      if (isFileExpired(f)) {
        toast("Ce document a expiré : il n'est plus consultable et va être supprimé.", 'warning');
        return;
      }
      setPreviewingFile(f);
    },
    [isFileExpired, toast],
  );

  // Notifications du partenaire (cloche d'en-tête) : pièces à corriger
  // signalées par l'antenne, avec le motif en explication.
  const notifItems = useMemo<NotificationItem[]>(() => {
    const out: NotificationItem[] = [];
    files.forEach((f) => {
      if (f.submissionStatus === 'Incomplete') {
        out.push({
          id: `corr_${f.id}`,
          title: 'Document à corriger',
          description: f.reviewNote && f.reviewNote.trim()
            ? `${f.name} — ${f.reviewNote}`
            : `${f.name} — correction demandée par votre antenne`,
          ts: (f as any).updatedAt || f.uploadDate || 0,
          tone: 'danger',
          onClick: () => setPreviewingFile(f),
        });
      }
      // Information « suppression automatique programmée » par l'antenne.
      const fi = expiryInfo(f.expiresAt);
      if (fi) {
        out.push({
          id: `exp_${f.id}`,
          title: 'Suppression automatique programmée',
          description: `${f.name} — sera supprimé le ${fi.date}.`,
          ts: f.expiresAt || 0,
          tone: (fi.tone === 'expired' || fi.tone === 'critical') ? 'danger' : fi.tone === 'soon' ? 'warning' : 'info',
          onClick: () => openFilePreview(f),
        });
      }
    });
    folders.forEach((fol) => {
      const di = expiryInfo(fol.expiresAt);
      if (di) {
        out.push({
          id: `expfol_${fol.id}`,
          title: 'Dossier à suppression automatique',
          description: `Dossier « ${fol.name} » et son contenu seront supprimés le ${di.date}.`,
          ts: fol.expiresAt || 0,
          tone: (di.tone === 'expired' || di.tone === 'critical') ? 'danger' : di.tone === 'soon' ? 'warning' : 'info',
          onClick: () => {
            if (isExpired(fol.expiresAt)) { toast('Ce dossier a expiré : il va être supprimé.', 'warning'); return; }
            setCurrentFolderId(fol.id);
          },
        });
      }
    });
    return out;
  }, [files, folders, openFilePreview, toast]);

  // Balayage des éléments arrivés à échéance que le partenaire peut lui-même
  // supprimer (ses propres pièces et dossiers ; pas ceux déposés par l'antenne).
  // En complément, l'UI bloque déjà l'accès aux fichiers expirés (cf. preview /
  // téléchargement) le temps qu'un poste autorisé les efface physiquement.
  const partnerSweepRunning = useRef(false);
  useEffect(() => {
    if (!user || partnerSweepRunning.current) return;
    const due =
      files.some((f) => isExpired(f.expiresAt)) || folders.some((f) => isExpired(f.expiresAt));
    if (!due) return;
    partnerSweepRunning.current = true;
    sweepExpired({
      files,
      folders,
      sandbox: localDb.isSandboxActive(),
      canDeleteFile: (f) => f.orgId === user.uid && f.uploadedBy !== 'admin',
      canDeleteFolder: (f) => f.orgId === user.uid && f.createdBy !== 'admin',
      onDeleted: (k, item) =>
        logAction(k === 'file' ? 'file_delete' : 'folder_delete', {
          targetType: k,
          targetId: item.id,
          targetName: (item as any).name,
          details: 'Suppression automatique à échéance',
        }),
    }).finally(() => { partnerSweepRunning.current = false; });
  }, [files, folders, user]);

  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [renameFolderInput, setRenameFolderInput] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  const handleCreateFolder = async (name: string) => {
    if (!user || !name.trim()) return;
    if (organization?.submissionStatus !== 'Validated') {
      toast("Votre compte doit être validé par un coordinateur ASF avant de pouvoir créer des dossiers.", 'warning');
      return;
    }
    if (localDb.isSandboxActive()) {
      localDb.saveFolder({
        id: 'local_folder_' + Date.now() + '_' + Math.random().toString(36).substring(5),
        orgId: user.uid,
        name: name.trim(),
        createdAt: Date.now(),
        createdBy: 'user',
        delegation_id: organization?.delegation_id || '',
        antenne_id: organization?.antenne_id || ''
      });
      refreshLocalState();
      notifyFolderCreated(name.trim());
      return;
    }
    await addDoc(collection(db, 'folders'), {
      orgId: user.uid,
      name: name.trim(),
      createdAt: Date.now(),
      createdBy: 'user',
      delegation_id: organization?.delegation_id || '',
      antenne_id: organization?.antenne_id || ''
    });
    notifyFolderCreated(name.trim());
  };

  const notifyFolderCreated = (folderName: string) => {
    const antName = (antennes[organization?.delegation_id || ''] || []).find(a => a.id === organization?.antenne_id)?.name;
    notifyAntenneOnUpload(
      organization?.antenne_id,
      'folder',
      folderName,
      { partnerName: organization?.name, antenneName: antName },
    );
    logAction('folder_create', { targetType: 'folder', targetName: folderName });
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renamingFile && renameInput.trim() !== '' && renameInput !== renamingFile.name) {
      const newName = renameInput.trim();
      const logIt = () => logAction('file_rename', {
        targetType: 'file',
        targetId: renamingFile.id,
        targetName: newName,
        details: `Renommé : « ${renamingFile.name} » → « ${newName} »`,
      });
      if (localDb.isSandboxActive()) {
        const file = { ...renamingFile, name: newName, updatedAt: Date.now() };
        localDb.saveFile(file);
        logIt();
        refreshLocalState();
        setRenamingFile(null);
        return;
      }
      try {
        // `updatedAt` permet à l'antenne de repérer un document modifié (badge « Nouveau »).
        await updateDoc(doc(db, 'files', renamingFile.id), { name: newName, updatedAt: Date.now() });
        logIt();
      } catch (error) {
        console.error('Error renaming file:', error);
      }
    }
    setRenamingFile(null);
  };

  // Soumission du dossier pour revue par l'antenne (l'organisme décide quand
  // il estime son dossier complet — aucun pré-requis bloquant).
  const [submittingDossier, setSubmittingDossier] = useState(false);
  // Confirmation locale de soumission (au cas où l'horodatage n'est pas encore
  // persisté sur le profil — règles non déployées).
  const [submittedAtLocal, setSubmittedAtLocal] = useState<number | null>(null);
  const dossierSubmittedAt = organization?.dossierSubmittedAt || submittedAtLocal;
  // Progression de validation (pour la carte « Soumettre mon dossier »).
  const validatedDocs = files.filter((f) => (f.submissionStatus || 'Pending') === 'Validated').length;
  const totalDocs = files.length;
  const remainingDocs = totalDocs - validatedDocs;
  const handleSubmitDossier = async () => {
    if (!organization || submittingDossier) return;
    setSubmittingDossier(true);
    const now = Date.now();
    try {
      if (localDb.isSandboxActive()) {
        const found = localDb.getOrganizations().find((o) => o.id === organization.id);
        if (found) localDb.saveOrganization({ ...found, dossierSubmittedAt: now, updatedAt: now });
        refreshLocalState();
      } else {
        // Marque le dossier sur le profil (badge « Dossier soumis » côté
        // antenne). Best-effort : si les règles ne sont pas encore déployées,
        // l'écriture est refusée — la notification passe alors par le journal
        // d'activité ci-dessous (canal toujours autorisé).
        try {
          await updateDoc(doc(db, 'organizations', organization.id), { dossierSubmittedAt: now, updatedAt: now });
        } catch (e) {
          console.warn('dossierSubmittedAt non écrit (règles non déployées ?), repli journal :', e);
        }
      }
      // Notification fiable au tableau de bord de l'antenne via le journal
      // d'activité. `org_profile_update` est une action autorisée pour un
      // partenaire même sans déploiement de règles ; `targetType` permet à
      // l'antenne de repérer un dépôt de dossier.
      const ok = await logAction('org_profile_update', {
        targetType: 'dossier_submission',
        targetId: organization.id,
        targetName: organization.name,
        details: "Dossier soumis pour revue par l'organisme.",
      });
      if (ok || localDb.isSandboxActive()) {
        setSubmittedAtLocal(now);
        toast('Dossier soumis à votre antenne ✓', 'success');
        // Prévient le gestionnaire d'antenne par e-mail (si activé).
        const antName = (antennes[organization.delegation_id || ''] || []).find(a => a.id === organization.antenne_id)?.name;
        notifyAntenneOnSubmission(organization.antenne_id, { partnerName: organization.name, antenneName: antName });
      } else {
        toast('La soumission a échoué, réessayez.', 'error');
      }
    } catch (err) {
      console.error('Error submitting dossier:', err);
      toast('La soumission a échoué, réessayez.', 'error');
    } finally {
      setSubmittingDossier(false);
    }
  };

  const confirmDeleteFile = async () => {
    if (!deletingFile) return;
    if (localDb.isSandboxActive()) {
      localDb.deleteFile(deletingFile.id);
      logAction('file_delete', { targetType: 'file', targetId: deletingFile.id, targetName: deletingFile.name });
      refreshLocalState();
      setDeletingFile(null);
      return;
    }
    try {
      await deleteFileArtifacts(deletingFile);
      await deleteDoc(doc(db, 'files', deletingFile.id));
      logAction('file_delete', { targetType: 'file', targetId: deletingFile.id, targetName: deletingFile.name });
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      setDeletingFile(null);
    }
  };

  const handleDownloadFile = async (file: DossierFile) => {
    if (isFileExpired(file)) {
      toast("Ce document a expiré : il n'est plus disponible et va être supprimé.", 'warning');
      return;
    }
    try {
      const ok = await downloadFile(file);
      if (ok) {
        logAction('file_download', { targetType: 'file', targetId: file.id, targetName: file.name });
      } else {
        toast('Téléchargement indisponible pour ce fichier.', 'warning');
      }
    } catch (error) {
      console.error('Failed to get download URL', error);
      toast('Échec du téléchargement du fichier. Il se peut qu\'il ait été supprimé ou que les règles de stockage n\'autorisent pas l\'accès.', 'error');
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFolder) return;
    const newName = renameFolderInput.trim();
    if (!newName || newName === renamingFolder.name) {
      setRenamingFolder(null);
      return;
    }
    const logIt = () => logAction('folder_rename', {
      targetType: 'folder',
      targetId: renamingFolder.id,
      targetName: newName,
      details: `Renommé : « ${renamingFolder.name} » → « ${newName} »`,
    });
    if (localDb.isSandboxActive()) {
      const found = localDb.getFolders().find((f) => f.id === renamingFolder.id);
      if (found) {
        localDb.saveFolder({ ...found, name: newName });
        logIt();
        refreshLocalState();
      }
      setRenamingFolder(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'folders', renamingFolder.id), { name: newName });
      logIt();
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast('Le renommage du dossier a échoué, réessayez.', 'error');
    } finally {
      setRenamingFolder(null);
    }
  };

  const confirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    const folderId = deletingFolder.id;
    // Supprimer un dossier supprime aussi tout ce qu'il contient ; les pièces
    // déposées par l'antenne (non supprimables par l'organisme) reviennent à la
    // racine pour ne pas devenir orphelines.
    const folderFiles = files.filter(f => f.folderId === folderId);
    const ownDeletable = (f: DossierFile) => f.orgId === user?.uid && f.uploadedBy !== 'admin';
    const closeIfOpen = () => { if (currentFolderId === folderId) setCurrentFolderId(null); };
    const logIt = () => logAction('folder_delete', {
      targetType: 'folder',
      targetId: folderId,
      targetName: deletingFolder.name,
    });
    if (localDb.isSandboxActive()) {
      // Conserver les pièces de l'antenne (les détacher avant la cascade locale).
      for (const f of folderFiles) {
        if (!ownDeletable(f)) {
          const t = localDb.getFiles().find((x) => x.id === f.id);
          if (t) { t.folderId = null; localDb.saveFile(t); }
        }
      }
      localDb.deleteFolder(folderId); // supprime le dossier + les pièces restantes (celles de l'organisme)
      logIt();
      refreshLocalState();
      closeIfOpen();
      setDeletingFolder(null);
      return;
    }
    try {
      for (const f of folderFiles) {
        if (ownDeletable(f)) {
          // Pièce de l'organisme : suppression complète (artefacts + document).
          try {
            await deleteFileArtifacts(f);
            await deleteDoc(doc(db, 'files', f.id));
            logAction('file_delete', { targetType: 'file', targetId: f.id, targetName: f.name, details: `Supprimé avec le dossier « ${deletingFolder.name} »` });
          } catch (e) { console.warn('Suppression du document contenu échouée:', f.id, e); }
        } else {
          // Pièce déposée par l'antenne : non supprimable par l'organisme → on
          // la remet à la racine pour ne pas la rendre orpheline.
          await updateDoc(doc(db, 'files', f.id), { folderId: null }).catch(() => {});
        }
      }
      await deleteDoc(doc(db, 'folders', folderId));
      logIt();
    } catch (error) {
      console.error('Error deleting folder:', error);
    } finally {
      closeIfOpen();
      setDeletingFolder(null);
    }
  };

  const handleDragStartFile = (e: React.DragEvent, file: DossierFile) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'move_file', fileId: file.id }));
  };

  const handleDropOnFolder = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'move_file' && parsed.fileId) {
          const moved = files.find(f => f.id === parsed.fileId);
          const dest = folderId ? (folders.find(f => f.id === folderId)?.name || 'un dossier') : 'la racine';
          const logIt = () => logAction('file_move', {
            targetType: 'file',
            targetId: parsed.fileId,
            targetName: moved?.name,
            details: `Déplacé vers ${folderId ? `« ${dest} »` : dest}`,
          });
          if (localDb.isSandboxActive()) {
            const list = localDb.getFiles();
            const found = list.find(f => f.id === parsed.fileId);
            if (found) {
              found.folderId = folderId;
              localDb.saveFile(found);
              logIt();
              refreshLocalState();
            }
            return;
          }
          await updateDoc(doc(db, 'files', parsed.fileId), { folderId: folderId });
          logIt();
        }
      } catch (error) {
        console.error("Error moving file", error);
      }
    }
  };

  const handleDragOverFolder = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-azur border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Chargement du portail équipage...</p>
        </div>
      </div>
    );
  }

  const MAX_STORAGE = 100 * 1024 * 1024; // 100 MB max storage
  const totalStorageUsed = files.reduce((acc, file) => acc + file.size, 0);
  const storagePercent = Math.min((totalStorageUsed / MAX_STORAGE) * 100, 100);

  // Apply search query filter, type filter, folder filter and sorting
  const filteredFiles = files
    .filter(f => {
      const matchesFolder = currentFolderId ? f.folderId === currentFolderId : !f.folderId;
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesType = true;
      if (fileTypeFilter === 'images') {
        matchesType = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name);
      } else if (fileTypeFilter === 'pdfs') {
        matchesType = f.type === 'application/pdf' || f.name.endsWith('.pdf');
      } else if (fileTypeFilter === 'texts') {
        matchesType = f.type.startsWith('text/') || /\.(txt|json|csv|md)$/i.test(f.name);
      } else if (fileTypeFilter === 'medias') {
        matchesType = f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|wav|ogg|m4a|mp4|webm|ogv)$/i.test(f.name);
      }
      
      const matchesStatus = fileStatusFilter === 'all' || (f.submissionStatus || 'Pending') === fileStatusFilter;

      // Un document arrivé à échéance est masqué immédiatement (le balayage le
      // supprimera physiquement) : il ne doit plus être consultable.
      const notExpired = !isExpired(f.expiresAt) && !(f.folderId && isExpired(folders.find((d) => d.id === f.folderId)?.expiresAt));

      return matchesFolder && matchesSearch && matchesType && matchesStatus && notExpired;
    })
    .sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'date-desc') return b.uploadDate - a.uploadDate;
      if (sortBy === 'date-asc') return a.uploadDate - b.uploadDate;
      if (sortBy === 'size-desc') return b.size - a.size;
      if (sortBy === 'size-asc') return a.size - b.size;
      return 0;
    });

  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Styling helpers
  const containerRounded = 'rounded-2xl';
  const cardShadow = 'shadow-xs';
  const borderStyle = `border ${themeConfig.cardBorder}`;

  return (
    <div className={`flex min-h-screen lg:h-screen ${themeConfig.bg} overflow-x-hidden overflow-y-auto lg:overflow-hidden ${themeConfig.fontFamily} text-slate-800 dark:text-slate-100 transition-colors duration-500`}>
      
      {/* Sidebar */}
      <aside className={`w-72 ${themeConfig.sidebarBg} flex flex-col hidden md:flex shrink-0 transition-colors duration-500`}>
        <div className="p-8 pb-10">
          <div className="flex items-center gap-3 mb-10">
            <LogoASF className="w-10 h-10 shrink-0" variant="white" />
            <div>
              <span className="text-xs font-black tracking-wide text-white uppercase block leading-tight">
                AVIATION
              </span>
              <span className="text-[10px] text-azur-pastel font-medium block">
                Sans Frontières France
              </span>
            </div>
          </div>

          <nav className="space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-4 text-slate-400 font-bold">Menu principal</p>
              <ul className="space-y-1.5">
                <li>
                  <button
                    onClick={() => setCurrentFolderId(null)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all text-left font-bold ${
                      !currentFolderId
                        ? themeConfig.sidebarActive
                        : `${themeConfig.sidebarText}`
                    }`}
                  >
                    <FileText className="w-4 h-4 text-azur" />
                    <span className="font-medium">Mes Fichiers & Dossiers</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Dossiers — création et navigation depuis la barre latérale */}
            <div data-tour="folders">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Dossiers</p>
                {organization.submissionStatus === 'Validated' && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    title="Nouveau dossier"
                    aria-label="Nouveau dossier"
                    className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {folders.length === 0 ? (
                <p className="text-[11px] text-slate-500 leading-relaxed px-1">
                  Aucun dossier pour l'instant.
                  {organization.submissionStatus === 'Validated' && ' Créez-en un avec le bouton +.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {folders.map((folder) => {
                    const count = files.filter((f) => f.folderId === folder.id).length;
                    const active = currentFolderId === folder.id;
                    return (
                      <li key={folder.id}>
                        <button
                          type="button"
                          onClick={() => setCurrentFolderId(folder.id)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all text-left ${
                            active ? themeConfig.sidebarActive : themeConfig.sidebarText
                          }`}
                        >
                          <FolderIcon className="w-4 h-4 text-azur-pastel shrink-0" />
                          <span className="flex-1 truncate font-medium">{folder.name}</span>
                          {folder.expiresAt ? (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); toast(`Le dossier « ${folder.name} » et son contenu seront supprimés automatiquement le ${formatExpiryDate(folder.expiresAt!)}.`, 'warning'); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toast(`Le dossier « ${folder.name} » et son contenu seront supprimés automatiquement le ${formatExpiryDate(folder.expiresAt!)}.`, 'warning'); } }}
                              title={`Suppression automatique le ${formatExpiryDate(folder.expiresAt)} — cliquez pour le détail`}
                              className={`shrink-0 cursor-pointer hover:opacity-80 ${expiryIconClass(folder.expiresAt)}`}
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                            </span>
                          ) : null}
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">{count}</span>
                          {folder.createdBy === 'admin' && (
                            <span className="px-1 py-0.5 rounded text-[7px] font-extrabold uppercase tracking-widest bg-amber-500/20 text-amber-300 shrink-0">Adm</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </nav>
        </div>

        {/* Sidebar Footer with Active Profile */}
        <div className="mt-auto p-5 border-t border-white/10 bg-black/5">
          {/* Indicateur de stockage compact */}
          <div data-tour="storage" className="mb-4 px-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5 text-slate-400">
              <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Stockage</span>
              <span>{Math.round(storagePercent)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${storagePercent > 90 ? 'bg-rose-500' : 'bg-azur'}`}
                style={{ width: `${storagePercent}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">{formatBytes(totalStorageUsed)} / 100 Mo</p>
          </div>

          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            data-tour="account"
            className="w-full flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 text-left transition-all mb-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-slate-300 text-deep flex items-center justify-center text-xs font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              {organization.contactName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-grow text-left">
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold truncate text-white">{organization.contactName}</p>
                <Settings className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <p className="text-[10px] text-slate-400 truncate font-sans font-semibold text-left">{organization.name}</p>
              {organization.delegation_id && (
                <p className="text-[9px] text-azur font-sans font-black mt-0.5 flex items-center gap-1 text-left min-w-0">
                  <span className="truncate min-w-0">📍 {getDelegationName(organization.delegation_id)}</span>
                  {organization.antenne_id && (
                    <>
                      <span className="opacity-40">•</span>
                      <span className="truncate min-w-0">{getAntenneName(organization.delegation_id, organization.antenne_id)}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          </button>
          <button 
            type="button"
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Mobile Drawer (slide-in sidebar) */}
      <div className={`md:hidden fixed inset-0 z-50 ${isMobileDrawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isMobileDrawerOpen}>
        {/* Backdrop */}
        <div
          onClick={() => setIsMobileDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isMobileDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Drawer panel */}
        <aside
          className={`absolute top-0 left-0 h-full w-[82%] max-w-xs ${themeConfig.sidebarBg} flex flex-col shadow-2xl transition-transform duration-300 ease-out ${isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="p-6 pb-8 overflow-y-auto flex-1">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <LogoASF className="w-9 h-9 shrink-0" variant="white" />
                <div>
                  <span className="text-xs font-black tracking-wide text-white uppercase block leading-tight">
                    AVIATION
                  </span>
                  <span className="text-[10px] text-azur-pastel font-medium block">
                    Sans Frontières France
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 bg-white/10 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                title="Fermer le menu"
                aria-label="Fermer le menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] mb-4 text-slate-400 font-bold">Menu principal</p>
                <ul className="space-y-1.5">
                  <li>
                    <button
                      onClick={() => { setCurrentFolderId(null); setIsMobileDrawerOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all text-left font-bold ${
                        !currentFolderId
                          ? themeConfig.sidebarActive
                          : `${themeConfig.sidebarText}`
                      }`}
                    >
                      <FileText className="w-4 h-4 text-azur" />
                      <span className="font-medium">Mes Fichiers & Dossiers</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Dossiers — création et navigation */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Dossiers</p>
                  {organization.submissionStatus === 'Validated' && (
                    <button
                      type="button"
                      onClick={() => { setIsCreatingFolder(true); setIsMobileDrawerOpen(false); }}
                      title="Nouveau dossier"
                      aria-label="Nouveau dossier"
                      className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {folders.length === 0 ? (
                  <p className="text-[11px] text-slate-500 leading-relaxed px-1">
                    Aucun dossier pour l'instant.
                    {organization.submissionStatus === 'Validated' && ' Créez-en un avec le bouton +.'}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {folders.map((folder) => {
                      const count = files.filter((f) => f.folderId === folder.id).length;
                      const active = currentFolderId === folder.id;
                      return (
                        <li key={folder.id}>
                          <button
                            type="button"
                            onClick={() => { setCurrentFolderId(folder.id); setIsMobileDrawerOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all text-left ${
                              active ? themeConfig.sidebarActive : themeConfig.sidebarText
                            }`}
                          >
                            <FolderIcon className="w-4 h-4 text-azur-pastel shrink-0" />
                            <span className="flex-1 truncate font-medium">{folder.name}</span>
                            {folder.expiresAt ? (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); toast(`Le dossier « ${folder.name} » et son contenu seront supprimés automatiquement le ${formatExpiryDate(folder.expiresAt!)}.`, 'warning'); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toast(`Le dossier « ${folder.name} » et son contenu seront supprimés automatiquement le ${formatExpiryDate(folder.expiresAt!)}.`, 'warning'); } }}
                                title={`Suppression automatique le ${formatExpiryDate(folder.expiresAt)} — cliquez pour le détail`}
                                className={`shrink-0 cursor-pointer hover:opacity-80 ${expiryIconClass(folder.expiresAt)}`}
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                              </span>
                            ) : null}
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">{count}</span>
                            {folder.createdBy === 'admin' && (
                              <span className="px-1 py-0.5 rounded text-[7px] font-extrabold uppercase tracking-widest bg-amber-500/20 text-amber-300 shrink-0">Adm</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </nav>
          </div>

          {/* Drawer Footer with storage + profile + logout */}
          <div className="mt-auto p-5 border-t border-white/10 bg-black/5 shrink-0">
            {/* Indicateur de stockage compact */}
            <div className="mb-4 px-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5 text-slate-400">
                <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Stockage</span>
                <span>{Math.round(storagePercent)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${storagePercent > 90 ? 'bg-rose-500' : 'bg-azur'}`}
                  style={{ width: `${storagePercent}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">{formatBytes(totalStorageUsed)} / 100 Mo</p>
            </div>

            <button
              type="button"
              onClick={() => { setIsProfileOpen(true); setIsMobileDrawerOpen(false); }}
              className="w-full flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 text-left transition-all mb-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-slate-300 text-deep flex items-center justify-center text-xs font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                {organization.contactName.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-grow text-left">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold truncate text-white">{organization.contactName}</p>
                  <Settings className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 truncate font-sans font-semibold text-left">{organization.name}</p>
                {organization.delegation_id && (
                  <p className="text-[9px] text-azur font-sans font-black mt-0.5 flex items-center gap-1 text-left min-w-0">
                    <span className="truncate min-w-0">📍 {getDelegationName(organization.delegation_id)}</span>
                    {organization.antenne_id && (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="truncate min-w-0">{getAntenneName(organization.delegation_id, organization.antenne_id)}</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Se déconnecter
            </button>
          </div>
        </aside>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto min-w-0">
        
        {/* Mobile Navbar */}
        <div className="md:hidden p-4 flex justify-between items-center rounded-xl mb-4 shrink-0 shadow-xs bg-slate-900 text-white">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-1.5 bg-white/10 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
              title="Ouvrir le menu"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <LogoASF className="w-8 h-8 shrink-0" variant="white" />
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              data-tour="account"
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer text-left min-w-0"
            >
              <div className="w-7 h-7 rounded-full bg-azur text-white flex items-center justify-center text-xs font-bold shrink-0">
                {organization.contactName.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold tracking-wider text-xs font-sans text-left truncate max-w-[120px]">{organization.contactName}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell items={notifItems} />
            {organization.antenne_id && (
              <button
                type="button"
                onClick={revealAntenneInfo}
                className="p-1.5 bg-white/10 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Voir les informations de votre antenne"
                aria-label="Mon antenne"
              >
                <Building2 className="w-4 h-4" />
              </button>
            )}
            <ThemeToggle className="w-8 h-8 !rounded-lg bg-white/10 border-transparent text-slate-200 hover:bg-white/20 hover:text-white dark:bg-white/10 dark:border-transparent dark:text-slate-200 dark:hover:bg-white/20 dark:hover:text-white" />
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="p-1.5 bg-white/10 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Mon Profil"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={signOut} className="p-1.5 bg-red-500/20 text-red-300 hover:text-red-100 rounded-lg transition-colors cursor-pointer" title="Se déconnecter">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dashboard Header Bar */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 shrink-0 gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5 text-left">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded bg-azur/10 text-azur border border-azur/20">
                Autorisation de mission Aviation Sans Frontières
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">/ Organisme</span>
              {organization.delegation_id && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded bg-azur/10 text-azur border border-azur/20">
                  📍 {getDelegationName(organization.delegation_id)}
                </span>
              )}
              {organization.antenne_id && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                  🏢 {getAntenneName(organization.delegation_id, organization.antenne_id)}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-deep dark:text-azur-pastel">
              Soumission des Dossiers & Autorisations
            </h1>
            <p className={`text-xs mt-1 ${themeConfig.textMuted}`}>
              Assurez-vous que les fichiers de vol obligatoires correspondent aux spécifications réglementaires requises par les coordinateurs de vol d'Aviation Sans Frontières.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <NotificationBell items={notifItems} className="hidden md:block" />
            <ThemeToggle className="hidden md:inline-flex" />
            {organization.antenne_id && (
              <button
                onClick={revealAntenneInfo}
                className="btn-secondary text-sm"
                title="Voir les informations de votre antenne"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Mon antenne</span>
              </button>
            )}
            <button
              onClick={() => setTourOpen(true)}
              data-tour="tutoriel"
              className="btn-sourire text-sm"
              title="Visite guidée de votre espace"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Tutoriel</span>
            </button>
            {/* Submission Status Card */}
            <div data-tour="status" className={`card-asf px-5 py-3 ${containerRounded} flex items-center gap-3`}>
              <div className="text-left">
                <p className={`text-[9px] uppercase tracking-widest font-bold ${themeConfig.textMuted}`}>Statut de la revue</p>
                <div className="mt-1">
                  <StatusBadge status={organization.submissionStatus} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Warning panel if Storage rules are missing */}
        {storageWarning && !isWarningDismissed && (
          <div className={`mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 p-4 ${containerRounded} flex flex-col gap-2 text-xs shrink-0 shadow-xs relative transition-all duration-305`}>
            {/* Close Button */}
            <button 
              onClick={() => {
                localStorage.setItem('asf_sandbox_warn_dismissed', 'true');
                setIsWarningDismissed(true);
              }}
              className="absolute top-3 right-3 text-amber-600/70 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 p-1.5 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
              title="Masquer l'alerte"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-bold text-amber-800 dark:text-amber-400">
                    Mode Sandbox Activé (Sauvegarde Sécurisée Firestore)
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/10 rounded">
                    Fallback 100% Opérationnel
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Le stockage binaire direct (Firebase Storage) est restreint sur le projet bac à sable automatisé. <strong>Tout fonctionne parfaitement :</strong> vos fichiers sont automatiquement convertis, indexés et stockés dans la base de données Firestore. Ils sont entièrement consultables et téléchargeables.
                </p>
                
                <button
                  type="button"
                  onClick={() => setShowWarningDetails(!showWarningDetails)}
                  className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showWarningDetails ? "🛈 Masquer les explications techniques" : "🛈 Pourquoi ai-je toujours ce message ? (Expliquez-moi)"}
                </button>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      localDb.setSandboxActive(false);
                      localStorage.removeItem('asf_sandbox_warn_dismissed');
                      window.location.reload();
                    }}
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer shadow-xs"
                    title="Tenter de se reconnecter à Firebase et quitter le mode bac à sable"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Réessayer la connexion Firebase
                  </button>
                </div>

                {showWarningDetails && (
                  <div className="mt-2.5 bg-white/45 dark:bg-black/15 p-3 rounded-xl border border-amber-500/10 transition-all duration-300">
                    {firebaseConfig.projectId === 'asf013' ? (
                      <div className="space-y-1.5 text-slate-500 dark:text-slate-400 leading-relaxed text-[10px]">
                        <p>
                          <strong>Pourquoi ce message apparaît-il ?</strong> L'application utilise actuellement un projet de test Firebase temporaire (<code>asf013</code>). Sur ce type d'environnement et à l'intérieur d'une Iframe sécurisée, le stockage de fichiers binaires bruts via Firebase Storage est verrouillé par Google Cloud.
                        </p>
                        <p>
                          <strong>La solution de secours automatique :</strong> Pour que vous puissiez tester sans contrainte, nous avons implémenté un système de découpage binaire automatique (<em>Chunks</em>) qui fragmente et sauvegarde vos fichiers volumineux directement dans Firestore. Tout est 100% fonctionnel et transparent pour vous !
                        </p>
                        <p className="pt-1.5 border-t border-amber-500/5 text-[9px] text-slate-400 dark:text-slate-500">
                          ℹ️ Pour lier votre propre base de données réelle sans cette alerte, modifiez simplement vos clés d'API dans le fichier de configuration <code>firebase-applet-config.json</code> à gauche.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-slate-500 dark:text-slate-400 leading-relaxed text-[10px]">
                        <p>
                          Vous utilisez votre propre projet Firebase personnalisé (<code>{firebaseConfig.projectId}</code>). Pour que Firebase Storage autorise les transferts de fichiers, veuillez configurer les règles de stockage dans votre console de projet.
                        </p>
                        <div className="pt-1">
                          <a 
                            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/storage/rules`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded shadow-xs text-[10px] inline-block transition-colors cursor-pointer"
                          >
                            Accéder à mes règles Firebase Storage ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notice : dépôt désactivé tant que le compte n'est pas validé */}
        {organization.submissionStatus !== 'Validated' && (
          <div
            className={`mb-6 shrink-0 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-4 ${containerRounded} flex items-center gap-4 shadow-xs`}
            title={organization.submissionStatus === 'Incomplete' ? 'Compte suspendu : envoi désactivé' : 'Compte en attente de validation'}
          >
            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
                {organization.submissionStatus === 'Incomplete'
                  ? 'Envoi de fichiers suspendu'
                  : 'Envoi en attente de validation'}
              </p>
              <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5 font-sans">
                {organization.submissionStatus === 'Incomplete'
                  ? 'Votre compte a été suspendu par un coordinateur ASF. Vous pourrez à nouveau déposer des fichiers une fois votre accès rétabli.'
                  : "Votre inscription doit d'abord être approuvée par un coordinateur ASF. Vous pourrez déposer vos fichiers dès que votre accès sera validé."}
              </p>
            </div>
          </div>
        )}

        {/* Votre antenne — profil renseigné par le gestionnaire, lecture seule */}
        {organization.antenne_id && (() => {
          const info = antenneInfo;
          const antName = getAntenneName(organization.delegation_id, organization.antenne_id);
          const rows = [
            { icon: MapPin, label: 'Aérodrome de rattachement', value: info?.airport },
            { icon: User, label: 'Coordinateur référent', value: info?.coordinatorName },
            { icon: Phone, label: 'Téléphone', value: info?.phone, href: info?.phone ? `tel:${info.phone.replace(/\s+/g, '')}` : undefined },
            { icon: Mail, label: 'E-mail de contact', value: info?.publicEmail, href: info?.publicEmail ? `mailto:${info.publicEmail}` : undefined },
            { icon: Plane, label: 'Flotte / aéronefs', value: info?.aircraft },
          ].filter((r) => r.value && r.value.trim());
          const hasContent = rows.length > 0 || (info?.description && info.description.trim());
          return (
            <div ref={antenneCardRef} className={`mb-6 shrink-0 scroll-mt-4 ${themeConfig.cardBg} ${borderStyle} ${containerRounded} overflow-hidden shadow-xs`}>
              <button
                type="button"
                onClick={() => setShowAntenneInfo((v) => !v)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                aria-expanded={showAntenneInfo}
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-azur to-deep text-white flex items-center justify-center shrink-0 shadow-asf-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">Votre antenne</p>
                  <h3 className="font-display text-deep dark:text-white font-bold tracking-tight text-sm truncate">{antName}</h3>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${showAntenneInfo ? 'rotate-180' : ''}`} />
              </button>

              {showAntenneInfo && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {hasContent ? (
                    <>
                      {rows.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          {rows.map((r) => {
                            const Icon = r.icon;
                            return (
                              <div key={r.label} className="flex items-start gap-2.5 min-w-0">
                                <span className="w-8 h-8 rounded-lg bg-azur/10 text-azur dark:text-azur-pastel flex items-center justify-center shrink-0">
                                  <Icon className="w-4 h-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">{r.label}</span>
                                  {r.href ? (
                                    <a href={r.href} className="block text-sm font-semibold text-deep dark:text-azur-pastel hover:underline break-words">{r.value}</a>
                                  ) : (
                                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{r.value}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {info?.description && info.description.trim() && (
                        <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3.5">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5" /> À propos
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{info.description}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                      Votre antenne n'a pas encore renseigné ses informations de contact. Elles apparaîtront ici dès qu'elle les aura complétées.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Progression de transmission des fichiers */}
        {uploading && (
          <div className={`mb-6 shrink-0 ${themeConfig.cardBg} ${borderStyle} p-4 ${containerRounded}`}>
            <div className={`flex justify-between text-xs font-semibold mb-2 ${themeConfig.textColor}`}>
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-azur" />
                Transmission des fichiers en cours vers votre dossier sécurisé...
              </span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
              <div
                className="bg-azur h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Soumission du dossier */}
        <div data-tour="submit" className="mb-6 shrink-0">
          <div className={`card-asf p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-azur/30 ${dossierSubmittedAt ? 'ring-1 ring-emerald-200 dark:ring-emerald-500/30' : ''}`}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-azur to-deep text-white flex items-center justify-center shrink-0 shadow-asf-md">
              <Send className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-deep dark:text-white font-bold tracking-tight text-sm">Soumettre mon dossier</h3>
              {dossierSubmittedAt ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1 font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 shrink-0" />
                  Dossier soumis le {new Date(dossierSubmittedAt).toLocaleDateString('fr-FR')} · en cours de revue par votre antenne.
                </p>
              ) : totalDocs > 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <span className="font-semibold text-deep dark:text-azur-pastel">{validatedDocs} document{validatedDocs > 1 ? 's' : ''} validé{validatedDocs > 1 ? 's' : ''} sur {totalDocs}</span>
                  {remainingDocs > 0
                    ? ` — il reste ${remainingDocs} pièce(s) à compléter avant l'envoi à votre antenne.`
                    : ' — toutes vos pièces sont prêtes à être soumises.'}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Quand vous estimez que votre dossier est complet, soumettez-le : votre antenne en est informée sur son tableau de bord et procède à la revue.
                </p>
              )}
            </div>
            <button
              onClick={handleSubmitDossier}
              disabled={submittingDossier}
              className={`${dossierSubmittedAt ? 'btn-secondary' : 'btn-asf'} text-sm justify-center shrink-0 w-full sm:w-auto disabled:opacity-60 group`}
              title={dossierSubmittedAt ? 'Renvoyer le dossier après modification' : 'Soumettre votre dossier pour revue'}
            >
              {submittingDossier ? 'Envoi…' : dossierSubmittedAt ? 'Soumettre à nouveau' : 'Soumettre'}
              {!submittingDossier && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        </div>

        {/* Verdict de revue (dérivé des statuts/notes des fichiers) */}
        {(() => {
          // Une correction n'est « en cours » que si la pièce est actuellement
          // marquée « À corriger ». La note de revue (`reviewNote`) peut subsister
          // après re-validation : on ne s'y fie donc pas pour le décompte.
          const corrections = files.filter((f) => f.submissionStatus === 'Incomplete');
          const hasFiles = files.length > 0;
          const allValidated = hasFiles && files.every((f) => (f.submissionStatus || 'Pending') === 'Validated');
          if (corrections.length > 0) {
            return (
              <div className="mb-4 rounded-2xl border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Corrections demandées par votre antenne ({corrections.length} pièce{corrections.length > 1 ? 's' : ''})
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">
                  Consultez la note « À corriger » sur les documents concernés ci-dessous, corrigez-les puis re-soumettez votre dossier.
                </p>
              </div>
            );
          }
          if (dossierSubmittedAt && allValidated) {
            return (
              <div className="mb-4 rounded-2xl border-l-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-4">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  Dossier validé par votre antenne
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-1">
                  Toutes vos pièces sont conformes. Aucune action requise.
                </p>
              </div>
            );
          }
          if (dossierSubmittedAt) {
            return (
              <div className="mb-4 rounded-2xl border-l-4 border-azur bg-azur/5 dark:bg-azur/10 border border-azur/20 dark:border-azur/30 p-4">
                <p className="text-sm font-bold text-deep dark:text-azur-pastel flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  Dossier en cours de revue
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Votre antenne examine vos pièces. Vous serez informé ici dès qu'une décision est prise.
                </p>
              </div>
            );
          }
          return null;
        })()}

        {/* Search, Filter & Sort Panel combined */}
        <div data-tour="filters" className={`mb-4 px-5 py-4.5 ${themeConfig.cardBg} ${borderStyle} ${containerRounded} flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 shadow-xs`}>

          {/* Left search */}
          <div className="relative w-full xl:w-72 shrink-0">
            <Search className={`absolute left-3.5 top-3 w-4 h-4 ${themeConfig.textMuted}`} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher des documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-asf pl-10 pr-14 text-xs"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800/50 hidden sm:block">⌘K</span>
          </div>

          {/* Middle Type Filters */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1 scrollbar-hide">
            {[
              { id: 'all', label: 'Tous les fichiers' },
              { id: 'pdfs', label: 'PDF' },
              { id: 'images', label: 'Images' },
              { id: 'texts', label: 'Textes' },
              { id: 'medias', label: 'Audios / Vidéos' },
            ].map((type) => {
              const active = fileTypeFilter === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setFileTypeFilter(type.id)}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
                    active
                      ? 'bg-azur text-white shadow-3xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>

          {/* Status quick filters */}
          <StatusFilterChips
            value={fileStatusFilter}
            onChange={setFileStatusFilter}
            className="overflow-x-auto py-1 scrollbar-hide"
            chipClass={(active) =>
              `px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer inline-flex items-center ${active ? 'bg-deep text-white shadow-3xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`
            }
          />

          {/* Right Sort dropdown */}
          <div className="flex items-center gap-2 self-end xl:self-auto">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${themeConfig.textMuted} shrink-0`}>Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`text-xs text-center px-2.5 py-1.5 border ${themeConfig.cardBorder} rounded-xl bg-transparent ${themeConfig.textColor} focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium`}
            >
              <option value="date-desc" className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">Date (Plus récent)</option>
              <option value="date-asc" className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">Date (Plus ancien)</option>
              <option value="name-asc" className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">Nom (A-Z)</option>
              <option value="name-desc" className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">Nom (Z-A)</option>
              <option value="size-desc" className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">Taille (Plus grand)</option>
              <option value="size-asc" className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">Taille (Plus petit)</option>
            </select>
          </div>

        </div>

        {/* Consolidated Files & Folders Workspace Container Card */}
        <section data-tour="docs" className={`flex-1 ${themeConfig.cardBg} ${borderStyle} ${containerRounded} ${cardShadow} overflow-hidden flex flex-col min-h-[350px] transition-all duration-300`}>
          
          {/* Header Controls line */}
          <div className={`px-6 py-4 border-b ${themeConfig.cardBorder} bg-slate-100/50 dark:bg-black/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0`}>
            
            <div className="flex items-center gap-2">
              {currentFolderId ? (
                <button 
                  onClick={() => setCurrentFolderId(null)} 
                  className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${themeConfig.btnSecondary}`}
                >
                  <CornerLeftUp className="w-3.5 h-3.5" /> Retour
                </button>
              ) : (
                <h2 className={`text-xs font-bold uppercase tracking-wider ${themeConfig.textColor}`}>
                  Espace de travail des documents de vol
                </h2>
              )}
              {currentFolder && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                  <span className={`text-xs font-black uppercase ${themeConfig.textColor}`}>
                    📂 {currentFolder.name}
                  </span>
                  {currentFolder.expiresAt ? <ExpiryBadge ts={currentFolder.expiresAt} /> : null}
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-xs ${themeConfig.textMuted} mr-1`}>
                {filteredFiles.length} élément{filteredFiles.length !== 1 ? 's' : ''} trouvé{filteredFiles.length !== 1 ? 's' : ''}
              </span>

              {/* Gestion du dossier ouvert (renommer / supprimer) */}
              {currentFolder && currentFolder.orgId === user.uid && currentFolder.createdBy !== 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setRenamingFolder(currentFolder); setRenameFolderInput(currentFolder.name); }}
                    className="flex items-center gap-1.5 text-xs font-semibold btn-ghost !py-1.5 !px-3 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Renommer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingFolder(currentFolder)}
                    className="flex items-center gap-1.5 text-xs font-semibold btn-ghost !py-1.5 !px-3 text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </>
              )}

              {organization.submissionStatus === 'Validated' && (
                <label data-tour="upload" className="flex items-center gap-1.5 text-xs font-semibold btn-secondary !py-1.5 !px-3 cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={handleFileChange} />
                  <Upload className="w-3.5 h-3.5" /> Déposer
                </label>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {filteredFiles.length === 0 && organization.submissionStatus !== 'Validated' ? (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <FileText className={`w-14 h-14 mb-4 opacity-30 ${themeConfig.textColor}`} />
                <h3 className={`text-sm font-bold ${themeConfig.textColor}`}>Aucun document de vol trouvé</h3>
                <p className={`text-xs ${themeConfig.textMuted} mt-1 max-w-sm`}>
                  Vos documents apparaîtront ici une fois votre compte validé par un coordinateur ASF.
                </p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {/* Fichiers (cartes) */}
                {filteredFiles.map((file, fileIdx) => {
                  const editable = file.orgId === user.uid && file.uploadedBy !== 'admin';
                  return (
                    <div
                      key={file.id}
                      data-tour={fileIdx === 0 ? 'doc-row' : undefined}
                      draggable
                      onDragStart={(e) => handleDragStartFile(e, file)}
                      onClick={() => setPreviewingFile(file)}
                      className="card-asf p-4 flex flex-col gap-3 cursor-pointer group relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 bg-azur-light dark:bg-azur/15 text-azur rounded-xl flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div data-tour={fileIdx === 0 ? 'doc-status' : undefined}>
                          <StatusBadge status={file.submissionStatus || 'Pending'} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[13px] font-semibold leading-snug line-clamp-2 ${themeConfig.textColor}`} title={file.name}>
                          {file.name}
                        </p>
                        <p className={`text-[11px] font-mono mt-1 ${themeConfig.textMuted}`}>
                          {file.type.split('/').pop()?.toUpperCase()} · {formatBytes(file.size)} · {new Date(file.uploadDate).toLocaleDateString('fr-FR')}
                        </p>
                        {file.uploadedBy === 'admin' && (
                          <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            Déposé par l'administrateur
                          </span>
                        )}
                        {file.expiresAt ? <div className="mt-2"><ExpiryBadge ts={file.expiresAt} /></div> : null}
                        {file.submissionStatus === 'Incomplete' && file.reviewNote && (
                          <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-2 py-1 flex items-start gap-1.5" title="Correction demandée par votre antenne">
                            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="min-w-0">À corriger : {file.reviewNote}</span>
                          </p>
                        )}
                      </div>
                      {/* Actions (au survol) */}
                      <div data-tour={fileIdx === 0 ? 'doc-actions' : undefined} className="flex items-center gap-1.5 mt-auto pt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }}
                          className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
                          title="Télécharger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {editable && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingFile(file); setRenameInput(file.name); }}
                              className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-all text-azur cursor-pointer"
                              title="Renommer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingFile(file); }}
                              className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-all text-red-500 cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Tuile de dépôt */}
                {organization.submissionStatus === 'Validated' && (
                  <label
                    onDragOver={handleDragOverFolder}
                    onDrop={(e) => handleDropOnFolder(e, currentFolderId)}
                    className="rounded-3xl border-[1.5px] border-dashed border-slate-300 dark:border-slate-700 hover:border-azur dark:hover:border-azur flex flex-col items-center justify-center gap-2 p-4 min-h-[132px] text-slate-400 dark:text-slate-500 hover:text-azur text-center cursor-pointer transition-colors"
                  >
                    <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    <CloudUpload className="w-6 h-6" />
                    <span className="text-xs font-semibold">Glissez vos documents ici</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modern Deletion Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={!!deletingFile}
        onClose={() => setDeletingFile(null)}
        onConfirm={confirmDeleteFile}
        itemName={deletingFile?.name || ''}
        itemType="file"
        itemSize={deletingFile ? formatBytes(deletingFile.size) : null}
      />

      <DeleteConfirmModal
        isOpen={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        onConfirm={confirmDeleteFolder}
        itemName={deletingFolder?.name || ''}
        itemType="folder"
        warning={(() => {
          if (!deletingFolder) return null;
          // Ne compter que les pièces réellement supprimées (celles de
          // l'organisme) : les pièces de l'antenne reviennent à la racine.
          const n = files.filter((f) => f.folderId === deletingFolder.id && f.orgId === user?.uid && f.uploadedBy !== 'admin').length;
          return n > 0 ? `Ce dossier contient ${n} document(s) : ils seront également supprimés.` : null;
        })()}
      />

      <FilePreviewModal
        isOpen={!!previewingFile}
        onClose={() => setPreviewingFile(null)}
        file={previewingFile}
        onDelete={(file) => {
          setPreviewingFile(null);
          setDeletingFile(file);
        }}
        orgName={organization.name}
        isAdmin={false}
      />

      <CreateFolderModal
        isOpen={isCreatingFolder}
        onClose={() => setIsCreatingFolder(false)}
        onConfirm={handleCreateFolder}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <GuidedTour open={tourOpen} steps={tourSteps} onClose={() => setTourOpen(false)} />

      {/* Modale de renommage de fichier */}
      {renamingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setRenamingFile(null)}
        >
          <form
            onSubmit={handleRenameSubmit}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-deep dark:text-white">Renommer le document</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Saisissez un nouveau nom de fichier.</p>
              </div>
            </div>
            <input
              autoFocus
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="input-asf w-full"
              placeholder="Nouveau nom du fichier"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRenamingFile(null)} className="btn-secondary text-sm">Annuler</button>
              <button type="submit" disabled={!renameInput.trim()} className="btn-asf text-sm disabled:opacity-60">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {/* Modale de renommage de dossier */}
      {renamingFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setRenamingFolder(null)}
        >
          <form
            onSubmit={handleRenameFolderSubmit}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                <FolderIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-deep dark:text-white">Renommer le dossier</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Saisissez un nouveau nom de dossier.</p>
              </div>
            </div>
            <input
              autoFocus
              type="text"
              value={renameFolderInput}
              onChange={(e) => setRenameFolderInput(e.target.value)}
              className="input-asf w-full"
              placeholder="Nouveau nom du dossier"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRenamingFolder(null)} className="btn-secondary text-sm">Annuler</button>
              <button type="submit" disabled={!renameFolderInput.trim()} className="btn-asf text-sm disabled:opacity-60">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
