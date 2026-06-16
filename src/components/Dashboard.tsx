import React, { useCallback, useEffect, useState } from 'react';
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
  X
} from 'lucide-react';
import { collection, query, where, onSnapshot, deleteDoc, doc, addDoc, updateDoc, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
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
import { firebaseConfig } from '../lib/firebaseConfig';
import { StatusBadge } from './ui';
import { getStatusMeta } from '../lib/status';


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
        return f.submissionStatus === 'Validated' && (f as any).sharedWithPartner !== false;
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
          return f.submissionStatus === 'Validated' && (f as any).sharedWithPartner !== false;
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
      console.warn("Firestore subscription or query error in Dashboard. Fallback to Local Storage Sandbox:", err);
      localDb.setSandboxActive(true);
      refreshLocalState();
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;
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
        setStorageWarning(
          `Mode Bac à Sable Actif : ${count} fichier(s) ont été enregistrés localement avec succès.`
        );
        setIsWarningDismissed(false);
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
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 105;
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
        setStorageWarning(
          `Firebase Storage a des permissions restreintes. ${fallbackCount} fichier(s) ont été envoyés avec succès directement dans la base de données Firestore sécurisée bac à sable.`
        );
        setIsWarningDismissed(false);
      } else {
        setStorageWarning(
          "Firebase Storage non configuré. L'envoi du fichier a échoué."
        );
        setIsWarningDismissed(false);
      }
    }
  }, [user, currentFolderId, organization, refreshLocalState]);

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
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [deletingFile, setDeletingFile] = useState<DossierFile | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  const handleCreateFolder = async (name: string) => {
    if (!user || !name.trim()) return;
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
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renamingFile && renameInput.trim() !== '' && renameInput !== renamingFile.name) {
      if (localDb.isSandboxActive()) {
        const file = { ...renamingFile, name: renameInput.trim() };
        localDb.saveFile(file);
        refreshLocalState();
        setRenamingFile(null);
        return;
      }
      try {
        await updateDoc(doc(db, 'files', renamingFile.id), { name: renameInput.trim() });
      } catch (error) {
        console.error('Error renaming file:', error);
      }
    }
    setRenamingFile(null);
  };

  const confirmDeleteFile = async () => {
    if (!deletingFile) return;
    if (localDb.isSandboxActive()) {
      localDb.deleteFile(deletingFile.id);
      refreshLocalState();
      setDeletingFile(null);
      return;
    }
    try {
      if (deletingFile.storagePath === 'firestore_fallback_chunked') {
        try {
          const chunksRef = collection(db, 'files', deletingFile.id, 'chunks');
          const querySnapshot = await getDocs(chunksRef);
          const deletePromises: Promise<void>[] = [];
          querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
          });
          await Promise.all(deletePromises);
        } catch (chunksErr) {
          console.error('Error deleting file chunks:', chunksErr);
        }
      } else if (deletingFile.storagePath !== 'firestore_fallback') {
        try {
          const fileRef = ref(storage, deletingFile.storagePath);
          await deleteObject(fileRef);
        } catch (storageErr: any) {
          if (storageErr.code !== 'storage/object-not-found') {
            console.error('Storage deletion error:', storageErr);
          }
        }
      }
      await deleteDoc(doc(db, 'files', deletingFile.id));
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      setDeletingFile(null);
    }
  };

  const handleDownloadFile = async (file: DossierFile) => {
    try {
      if (file.storagePath === 'firestore_fallback' && file.fallbackDataUrl) {
        const link = document.createElement('a');
        link.href = file.fallbackDataUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      if (file.storagePath === 'firestore_fallback_chunked') {
        const chunksRef = collection(db, 'files', file.id, 'chunks');
        const q = query(chunksRef, orderBy('index', 'asc'));
        const querySnapshot = await getDocs(q);
        
        const chunksData: string[] = [];
        querySnapshot.forEach((doc) => {
          chunksData.push(doc.data().data);
        });
        
        const fullBase64 = chunksData.join('');
        
        const link = document.createElement('a');
        link.href = fullBase64;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      const fileRef = ref(storage, file.storagePath);
      const url = await getDownloadURL(fileRef);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to get download URL', error);
      toast('Échec du téléchargement du fichier. Il se peut qu\'il ait été supprimé ou que les règles de stockage n\'autorisent pas l\'accès.', 'error');
    }
  };

  const confirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    const folderFiles = files.filter(f => f.folderId === deletingFolder.id);
    if (folderFiles.length > 0) {
      toast('Impossible de supprimer le dossier car il n\'est pas vide.', 'warning');
      setDeletingFolder(null);
      return;
    }
    if (localDb.isSandboxActive()) {
      localDb.deleteFolder(deletingFolder.id);
      refreshLocalState();
      setDeletingFolder(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'folders', deletingFolder.id));
    } catch (error) {
      console.error('Error deleting folder:', error);
    } finally {
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
          if (localDb.isSandboxActive()) {
            const list = localDb.getFiles();
            const found = list.find(f => f.id === parsed.fileId);
            if (found) {
              found.folderId = folderId;
              localDb.saveFile(found);
              refreshLocalState();
            }
            return;
          }
          await updateDoc(doc(db, 'files', parsed.fileId), { folderId: folderId });
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-500 font-sans">
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
      
      return matchesFolder && matchesSearch && matchesType;
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

  const displayedFolders = currentFolderId 
    ? [] 
    : folders.filter(fol => fol.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Styling helpers
  const containerRounded = 'rounded-2xl';
  const cardShadow = 'shadow-xs';
  const borderStyle = `border ${themeConfig.cardBorder}`;

  return (
    <div className={`flex min-h-screen lg:h-screen ${themeConfig.bg} overflow-y-auto lg:overflow-hidden ${themeConfig.fontFamily} text-[#1a1a1a] transition-colors duration-500`}>
      
      {/* Sidebar */}
      <aside className={`w-72 ${themeConfig.sidebarBg} flex flex-col hidden md:flex shrink-0 transition-colors duration-500`}>
        <div className="p-8 pb-10">
          <div className="flex items-center gap-3 mb-10">
            <LogoASF className="w-10 h-10 shrink-0" variant="white" />
            <div>
              <span className="text-xs font-black tracking-wide text-white uppercase block leading-tight">
                AVIATION
              </span>
              <span className="text-[10px] text-sky-300 font-medium block">
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
          </nav>
        </div>

        {/* Sidebar Footer with Active Profile */}
        <div className="mt-auto p-5 border-t border-white/10 bg-black/5">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
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
                <p className="text-[9px] text-[#1b98c4] truncate font-sans font-black mt-0.5 flex items-center gap-1 text-left">
                  <span>📍 {getDelegationName(organization.delegation_id)}</span>
                  {organization.antenne_id && (
                    <>
                      <span className="opacity-40">•</span>
                      <span>{getAntenneName(organization.delegation_id, organization.antenne_id)}</span>
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

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto min-w-0">
        
        {/* Mobile Navbar */}
        <div className="md:hidden p-4 flex justify-between items-center rounded-xl mb-4 shrink-0 shadow-xs bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <LogoASF className="w-8 h-8 shrink-0" variant="white" />
            <button 
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer text-left"
            >
              <div className="w-7 h-7 rounded-full bg-azur text-white flex items-center justify-center text-xs font-bold shrink-0">
                {organization.contactName.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold tracking-wider text-xs font-sans text-left truncate max-w-[120px]">{organization.contactName}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
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
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5 text-left">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded bg-azur/10 text-azur border border-azur/20">
                Autorisation de mission Aviation Sans Frontières
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">/ Organisme</span>
              {organization.delegation_id && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded bg-azur/10 text-azur border border-azur/20">
                  📍 {getDelegationName(organization.delegation_id)}
                </span>
              )}
              {organization.antenne_id && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-505 text-emerald-400 border border-emerald-555/20">
                  🏢 {getAntenneName(organization.delegation_id, organization.antenne_id)}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-deep">
              Soumission des Dossiers & Autorisations
            </h1>
            <p className={`text-xs mt-1 ${themeConfig.textMuted}`}>
              Assurez-vous que les fichiers de vol obligatoires correspondent aux spécifications réglementaires requises par les coordinateurs de vol d'Aviation Sans Frontières.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Submission Status Card */}
            <div className={`card-asf px-5 py-3 ${containerRounded} flex items-center gap-3`}>
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
              <AlertCircle className="w-5 h-5 text-amber-650 dark:text-amber-450 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-bold text-amber-850 dark:text-amber-400">
                    Mode Sandbox Activé (Sauvegarde Sécurisée Firestore)
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-amber-500/15 text-amber-705 dark:text-amber-305 border border-amber-500/10 rounded">
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
                        <p className="pt-1.5 border-t border-amber-500/5 text-[9px] text-slate-405">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 shrink-0">
          
          {/* Draggable Drop/Click Upload Area */}
          <div className="lg:col-span-2">
            <label 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white border-2 border-dashed ${themeConfig.textColor} hover:brightness-98 transition-all duration-300 p-6 flex flex-col sm:flex-row items-center justify-center gap-5 cursor-pointer shadow-xs ${containerRounded} ${
                isDragActive
                  ? 'border-azur bg-azur/5 scale-101'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <input 
                type="file" 
                multiple 
                className="hidden" 
                onChange={handleFileChange} 
              />
              <div className="w-12 h-12 bg-azur-light text-deep rounded-full flex items-center justify-center shadow-xs">
                <CloudUpload className="w-6 h-6 animate-bounce" />
              </div>
              <div className="text-center sm:text-left">
                <p className={`text-base font-bold ${themeConfig.textColor}`}>
                  {isDragActive ? 'Relâchez pour lancer la transmission' : 'Déposez les fichiers de vol ici ou cliquez pour téléverser'}
                </p>
                <p className={`text-xs ${themeConfig.textMuted} mt-1 font-sans`}>
                  Faites les glisser sur les dossiers ci-dessous pour les classer directement. Formats acceptés : PDF, manifestes de vol, images.
                </p>
              </div>
            </label>

            {uploading && (
              <div className={`mt-3 ${themeConfig.cardBg} ${borderStyle} p-4 ${containerRounded} animate-pulse`}>
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
          </div>
          
          {/* Storage Capacity Indicator Card */}
          <div className={`${themeConfig.cardBg} ${borderStyle} p-6 ${containerRounded} ${cardShadow} flex flex-col justify-center transition-all duration-300`}>
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 font-sans">
              <span className={`flex items-center gap-1 ${themeConfig.textColor}`}>
                <HardDrive className="w-3.5 h-3.5 text-azur" /> Espace de Stockage Alloué
              </span>
              <span className={themeConfig.textMuted}>{Math.round(storagePercent)}% de 100 Mo</span>
            </div>
            <div className={`text-3xl font-black ${themeConfig.textColor} mb-3`}>{formatBytes(totalStorageUsed)}</div>
            <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  storagePercent > 90
                    ? 'bg-rose-500'
                    : 'bg-azur'
                }`}
                style={{ width: `${storagePercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Search, Filter & Sort Panel combined */}
        <div className={`mb-4 px-5 py-4.5 ${themeConfig.cardBg} ${borderStyle} ${containerRounded} flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 shadow-xs`}>
          
          {/* Left search */}
          <div className="relative w-full xl:w-72 shrink-0">
            <Search className={`absolute left-3.5 top-3 w-4 h-4 ${themeConfig.textMuted}`} />
            <input
              type="text"
              placeholder="Rechercher des documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-asf pl-10 text-xs"
            />
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
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>

          {/* Right Sort dropdown */}
          <div className="flex items-center gap-2 self-end xl:self-auto">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${themeConfig.textMuted} shrink-0`}>Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`text-xs px-2.5 py-1.5 border ${themeConfig.cardBorder} rounded-xl bg-transparent ${themeConfig.textColor} focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium`}
            >
              <option value="date-desc" className="text-slate-900 bg-white">Date (Plus récent)</option>
              <option value="date-asc" className="text-slate-900 bg-white">Date (Plus ancien)</option>
              <option value="name-asc" className="text-slate-900 bg-white">Nom (A-Z)</option>
              <option value="name-desc" className="text-slate-900 bg-white">Nom (Z-A)</option>
              <option value="size-desc" className="text-slate-900 bg-white">Taille (Plus grand)</option>
              <option value="size-asc" className="text-slate-900 bg-white">Taille (Plus petit)</option>
            </select>
          </div>

        </div>

        {/* Consolidated Files & Folders Workspace Container Card */}
        <section className={`flex-1 ${themeConfig.cardBg} ${borderStyle} ${containerRounded} ${cardShadow} overflow-hidden flex flex-col min-h-[350px] transition-all duration-300`}>
          
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
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-xs ${themeConfig.textMuted}`}>
                {filteredFiles.length + displayedFolders.length} élément{filteredFiles.length + displayedFolders.length !== 1 ? 's' : ''} trouvé{filteredFiles.length + displayedFolders.length !== 1 ? 's' : ''}
              </span>
              
              {!currentFolderId && (
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-azur-light text-azur hover:bg-azur/15 border border-azur/20 hover:border-azur/40 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-3xs"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Nouveau dossier
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {filteredFiles.length === 0 && displayedFolders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <FileText className={`w-14 h-14 mb-4 opacity-30 ${themeConfig.textColor}`} />
                <h3 className={`text-sm font-bold ${themeConfig.textColor}`}>Aucun document de vol trouvé</h3>
                <p className={`text-xs ${themeConfig.textMuted} mt-1 max-w-sm`}>
                  Vous pouvez commencer par créer des dossiers thématiques ou faire glisser directement des documents dans cet espace.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`text-[10px] font-bold uppercase tracking-wider border-b ${themeConfig.cardBorder} bg-black/5`}>
                      <th className={`px-6 py-3.5 ${themeConfig.textColor}`}>Nom du Dossier / Fichier</th>
                      <th className={`px-6 py-3.5 text-center w-36 ${themeConfig.textColor}`}>Statut</th>
                      <th className={`px-6 py-3.5 text-center w-36 ${themeConfig.textColor}`}>Format & Taille</th>
                      <th className={`px-6 py-3.5 w-40 ${themeConfig.textColor}`}>Date d'ajout</th>
                      <th className={`px-6 py-3.5 text-right w-36 ${themeConfig.textColor}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Render active Subfolders */}
                    {displayedFolders.map((folder) => (
                      <tr 
                        key={folder.id} 
                        className={`transition-colors cursor-pointer group hover:bg-[#001f3f]/5`}
                        onClick={() => setCurrentFolderId(folder.id)}
                        onDragOver={handleDragOverFolder}
                        onDrop={(e) => handleDropOnFolder(e, folder.id)}
                      >
                        <td className="px-6 py-4 font-medium flex items-center gap-4">
                          <div className="w-9 h-9 bg-azur/10 text-azur rounded-lg flex items-center justify-center shrink-0">
                            <FolderIcon className="w-5 h-5 fill-current" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold truncate ${themeConfig.textColor}`}>{folder.name}</span>
                              {folder.createdBy === 'admin' ? (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-amber-105 bg-amber-100 text-amber-800 border border-amber-200">
                                  Administrateur
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                  {organization.name}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] ${themeConfig.textMuted}`}>Glissez des fichiers ici pour les classer directement</span>
                          </div>
                        </td>
                        <td className={`px-6 py-4 text-center text-xs font-mono font-medium ${themeConfig.textMuted}`}>--</td>
                        <td className={`px-6 py-4 text-center text-xs font-mono font-medium ${themeConfig.textMuted}`}>-- Répertoire</td>
                        <td className={`px-6 py-4 text-xs ${themeConfig.textMuted}`}>{new Date(folder.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          {folder.orgId === user.uid && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingFolder(folder); }}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1.5 focus:outline-none cursor-pointer"
                              title="Supprimer le dossier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Render active Files inside directory */}
                    {filteredFiles.map((file) => (
                      <tr 
                        key={file.id} 
                        className="transition-colors group hover:bg-black/5 cursor-pointer"
                        draggable
                        onDragStart={(e) => handleDragStartFile(e, file)}
                        onClick={() => setPreviewingFile(file)}
                      >
                        <td className="px-6 py-4 flex items-center gap-4">
                          <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {renamingFile?.id === file.id ? (
                              <form onSubmit={handleRenameSubmit} className="flex items-center gap-1.5 max-w-xs" onClick={e => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={renameInput}
                                  onChange={(e) => setRenameInput(e.target.value)}
                                  className="input-asf text-xs py-1"
                                  autoFocus
                                />
                                <button type="submit" className="btn-asf text-[10px] px-2 py-1">Enregistrer</button>
                                <button type="button" onClick={() => setRenamingFile(null)} className="btn-secondary text-[10px] px-1.5 py-1">X</button>
                              </form>
                            ) : (
                              <div className="flex flex-col min-w-0 font-sans">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold truncate ${themeConfig.textColor}`} title={file.name}>
                                    {file.name}
                                  </span>
                                  {file.uploadedBy === 'admin' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-amber-100 text-amber-800 border border-amber-200">
                                      Administrateur
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                      {organization.name}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] text-slate-400 font-mono tracking-tight flex items-center gap-1 mt-1">
                                  ID : {file.id.substring(0, 8)} | Type : {file.type.split('/').pop()?.toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <StatusBadge status={file.submissionStatus || 'Pending'} />
                        </td>
                        <td className={`px-6 py-4 text-center font-mono text-xs font-semibold ${themeConfig.textMuted}`}>
                          {formatBytes(file.size)}
                        </td>
                        <td className={`px-6 py-4 text-xs ${themeConfig.textMuted}`}>
                          {new Date(file.uploadDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center space-x-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }}
                              className={`p-1.5 bg-white border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-405 transition-all text-slate-600 cursor-pointer`}
                              title="Télécharger"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {file.orgId === user.uid && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRenamingFile(file); setRenameInput(file.name); }}
                                  className={`p-1.5 bg-white border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-405 transition-all text-azur cursor-pointer`}
                                  title="Renommer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeletingFile(file); }}
                                  className={`p-1.5 bg-white border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-405 transition-all text-red-500 cursor-pointer`}
                                  title="Purger définitivement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
    </div>
  );
}
