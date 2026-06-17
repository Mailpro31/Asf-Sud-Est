import React, { useState } from 'react';
import { formatBytes } from '../lib/utils';
import { motion } from 'motion/react';
import { 
  collection, 
  updateDoc, 
  doc, 
  deleteDoc, 
  addDoc 
} from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { 
  ArrowLeft, 
  ChevronRight, 
  Search, 
  CloudUpload, 
  RefreshCw, 
  FileText, 
  Edit2, 
  Download, 
  Trash2, 
  Plus, 
  X, 
  Folder as FolderIcon 
} from 'lucide-react';

import { db, storage } from '../lib/firebase';
import { Organization, DossierFile, Folder, SubmissionStatus } from '../types';
import { localDb } from '../lib/localDb';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../context/AuthContext';

interface OrgCabinetModalProps {
  selectedOrgForFiles: Organization;
  files: DossierFile[];
  folders: Folder[];
  delegationFilterId: string;
  onClose: () => void;
  setFiles: React.Dispatch<React.SetStateAction<DossierFile[]>>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
}


export default function OrgCabinetModal({
  selectedOrgForFiles: org,
  files,
  folders,
  delegationFilterId,
  onClose,
  setFiles,
  setFolders,
}: OrgCabinetModalProps) {
  const { antennes: ANTENNES_BY_DELEGATION } = useAuth();
  const { toast, confirm } = useFeedback();

  // Localized states to clean up AdminPanel
  const [orgOpenFolderId, setOrgOpenFolderId] = useState<string | null>(null);
  const [orgFilesSearch, setOrgFilesSearch] = useState('');
  const [isCreatingOrgFolder, setIsCreatingOrgFolder] = useState(false);
  const [orgUploading, setOrgUploading] = useState(false);
  const [orgUploadProgress, setOrgUploadProgress] = useState(0);
  const [renamingFile, setRenamingFile] = useState<DossierFile | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const orgFolders = folders.filter(f => f.orgId === org.id);
  const currentFolder = folders.find(fd => fd.id === orgOpenFolderId);
  
  // Get files for this org and folder, filtering by search query if any
  const orgFiles = files.filter(f => {
    const matchesOrg = f.orgId === org.id;
    const matchesFolder = f.folderId === orgOpenFolderId;
    const matchesSearch = f.name.toLowerCase().includes(orgFilesSearch.toLowerCase());
    return matchesOrg && matchesFolder && matchesSearch;
  });

  const handleOrgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFilesArr = Array.from(e.target.files) as File[];
    setOrgUploading(true);
    setOrgUploadProgress(0);

    if (localDb.isSandboxActive()) {
      for (const f of selectedFilesArr) {
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = () => {
            const mockFile: DossierFile = {
              id: `mock_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              orgId: org.id,
              folderId: orgOpenFolderId || null,
              delegation_id: org.delegation_id || delegationFilterId || '',
              antenne_id: org.antenne_id || '',
              name: f.name,
              size: f.size,
              type: f.type || 'application/octet-stream',
              storagePath: 'sandbox_cabinet',
              fallbackDataUrl: reader.result as string,
              uploadDate: Date.now(),
              uploadedBy: 'admin',
              submissionStatus: 'Validated'
            };
            localDb.saveFile(mockFile);
            resolve();
          };
          reader.readAsDataURL(f);
        });
      }
      setFiles(localDb.getFiles());
      setOrgUploading(false);
      setOrgUploadProgress(0);
      if (e.target) e.target.value = '';
      return;
    }

    for (const f of selectedFilesArr) {
      const storagePath = `dossiers/${org.id}/${Date.now()}_${f.name}`;
      const storageRef = ref(storage, storagePath);
      
      try {
        const uploadTask = uploadBytesResumable(storageRef, f);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setOrgUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, 'files'), {
                  orgId: org.id,
                  folderId: orgOpenFolderId || null,
                  delegation_id: org.delegation_id || delegationFilterId || '',
                  antenne_id: org.antenne_id || '',
                  name: f.name,
                  size: f.size,
                  type: f.type || 'application/octet-stream',
                  storagePath: storagePath,
                  fallbackDataUrl: downloadUrl,
                  uploadDate: Date.now(),
                  uploadedBy: 'admin',
                  submissionStatus: 'Validated'
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      } catch (err) {
        console.warn('Storage uploads failed, starting database base64 fallback...', err);
        try {
          const fallbackUrl = await new Promise<string>((resolveBase64) => {
            const r = new FileReader();
            r.onload = () => resolveBase64(r.result as string);
            r.readAsDataURL(f);
          });
          await addDoc(collection(db, 'files'), {
            orgId: org.id,
            folderId: orgOpenFolderId || null,
            delegation_id: org.delegation_id || delegationFilterId || '',
            antenne_id: org.antenne_id || '',
            name: f.name,
            size: f.size,
            type: f.type || 'application/octet-stream',
            storagePath: 'firestore_fallback',
            fallbackDataUrl: fallbackUrl,
            uploadDate: Date.now(),
            uploadedBy: 'admin',
            submissionStatus: 'Validated'
          });
        } catch (baseErr) {
          toast(`Erreur de secours pour l'upload de ${f.name} : ${baseErr}`, 'error');
        }
      }
    }
    setOrgUploading(false);
    setOrgUploadProgress(0);
    if (e.target) e.target.value = '';
  };

  const handleCreateOrgFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const folderName = (formData.get('name') as string)?.trim();
    if (!folderName) return;

    if (localDb.isSandboxActive()) {
      const mockFolder: Folder = {
        id: `mock_folder_${Date.now()}`,
        orgId: org.id,
        name: folderName,
        createdAt: Date.now(),
        createdBy: 'admin',
        delegation_id: org.delegation_id || delegationFilterId || '',
        antenne_id: org.antenne_id || ''
      };
      localDb.saveFolder(mockFolder);
      setFolders(localDb.getFolders());
      setIsCreatingOrgFolder(false);
      return;
    }

    try {
      await addDoc(collection(db, 'folders'), {
        orgId: org.id,
        name: folderName,
        createdAt: Date.now(),
        createdBy: 'admin',
        delegation_id: org.delegation_id || delegationFilterId || '',
        antenne_id: org.antenne_id || ''
      });
      setIsCreatingOrgFolder(false);
    } catch (err) {
      console.error("Error creating folder within profile:", err);
    }
  };

  const handleDeleteOrgFolder = async (folderId: string, folderName: string) => {
    if (!await confirm(`Êtes-vous sûr de vouloir supprimer le dossier "${folderName}" et l'intégralité des justificatifs qu'il contient ?`)) return;
    if (localDb.isSandboxActive()) {
      localDb.deleteFolder(folderId);
      setFiles(localDb.getFiles());
      setFolders(localDb.getFolders());
      if (orgOpenFolderId === folderId) {
        setOrgOpenFolderId(null);
      }
      return;
    }
    try {
      // Delete files inside
      const relatedFiles = files.filter(f => f.folderId === folderId);
      for (const f of relatedFiles) {
        await deleteDoc(doc(db, 'files', f.id));
      }
      await deleteDoc(doc(db, 'folders', folderId));
      if (orgOpenFolderId === folderId) {
        setOrgOpenFolderId(null);
      }
    } catch (err) {
      console.error("Error deleting folder within profile:", err);
    }
  };

  const handleDeleteOrgFile = async (fileId: string, fileName: string) => {
    if (!await confirm(`Êtes-vous sûr de vouloir de supprimer définitivement le justificatif "${fileName}" ?`)) return;
    if (localDb.isSandboxActive()) {
      localDb.deleteFile(fileId);
      setFiles(localDb.getFiles());
      return;
    }
    try {
      await deleteDoc(doc(db, 'files', fileId));
    } catch (err) {
      console.error("Error deleting file within profile:", err);
    }
  };

  const handleUpdateOrgFileStatus = async (fileId: string, newStatus: SubmissionStatus) => {
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
      console.error("Error updating status inside profile cabinet:", err);
    }
  };

  const handleStartRenaming = (file: DossierFile) => {
    setRenamingFile(file);
    setRenameInput(file.name);
  };

  const handleConfirmRename = async () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs cursor-pointer"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header colored banner indicating active delegation theme */}
        <div className={`h-1.5 w-full ${
          org.delegation_id === 'ouest' ? 'bg-indigo-600' :
          org.delegation_id === 'occitanie' ? 'bg-rose-600' :
          org.delegation_id === 'sud-est' ? 'bg-blue-600' :
          'bg-emerald-600'
        }`} />

        {/* Top Title Bar */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="space-y-1 text-left">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
              org.delegation_id === 'ouest' ? 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/40 dark:text-indigo-400' :
              org.delegation_id === 'occitanie' ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/40 dark:text-rose-400' :
              org.delegation_id === 'sud-est' ? 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-950/40 dark:border-blue-900/40 dark:text-blue-400' :
              'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/40 dark:text-emerald-400'
            }`}>
              📍 {org.delegation_id?.toUpperCase()} - {org.antenne_id ? (ANTENNES_BY_DELEGATION[org.delegation_id || '']?.find((a: any) => a.id === org.antenne_id)?.name || org.antenne_id) : 'SANS VILLE'}
            </span>
            <h3 className="text-lg font-display font-black text-deep dark:text-white flex items-center gap-2">
              📁 Cabinet Documentaire : <span className="text-azur font-black">{org.name}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Inner Area Scrollable */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-left">
          
          {/* NAVIGATION OR OVERVIEW */}
          {orgOpenFolderId ? (
            // --- INSIDE A SELECTED FOLDER VIEW ---
            <div className="space-y-4 text-left">
              {/* Folder Breadcrumb */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setOrgOpenFolderId(null); setOrgFilesSearch(''); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Dossiers
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1">
                    📂 {currentFolder?.name}
                  </span>
                </div>

                {/* Search */}
                <div className="relative max-w-xs w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un fichier..."
                    value={orgFilesSearch}
                    onChange={(e) => setOrgFilesSearch(e.target.value)}
                    className="input-asf pl-9 text-xs dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* File Uploader for this folder */}
              <div className="bg-emerald-500/5 border border-emerald-200/30 rounded-2xl p-4 space-y-3 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="text-left">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 block">📥 Téléverser un justificatif réglementaire</span>
                    <span className="text-[10px] text-slate-400 block">Ajoutez un justificatif de vol (PDF, Image, Manifeste) directement dans ce dossier de l'organisme.</span>
                  </div>
                  
                  <label className="flex items-center gap-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer shrink-0">
                    <CloudUpload className="w-4 h-4" />
                    <span>Verser un justificatif</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleOrgUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {orgUploading && (
                  <div className="space-y-1.5 bg-white dark:bg-slate-950 p-3 border border-emerald-100 rounded-xl text-left">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1 animate-pulse text-emerald-600">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Téléversement en cours...
                      </span>
                      <span>{orgUploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${orgUploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Files inside the folder table */}
              {orgFiles.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <FileText className="w-10 h-10 text-slate-300" />
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Aucun fichier dans ce dossier</p>
                    <p className="text-[10.5px] text-slate-400">Sélectionnez un justificatif avec le bouton de téléversement ci-dessus pour l'ajouter.</p>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-3">Document</th>
                        <th className="px-4 py-3 w-32">Propriétaire</th>
                        <th className="px-4 py-3 w-40">Statut de validation</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px] text-slate-700 dark:text-slate-300">
                      {orgFiles.map(file => {
                        const isOriginalRenaming = renamingFile?.id === file.id;
                        return (
                          <tr key={file.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="px-4 py-3">
                              {isOriginalRenaming ? (
                                <div className="flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-azur rounded p-1 bg-white dark:bg-slate-900 border">
                                  <input
                                    type="text"
                                    value={renameInput}
                                    onChange={(e) => setRenameInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleConfirmRename();
                                      if (e.key === 'Escape') setRenamingFile(null);
                                    }}
                                    className="w-full text-xs font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleConfirmRename}
                                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded cursor-pointer font-bold"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => setRenamingFile(null)}
                                    className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded cursor-pointer"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <div className="text-left">
                                  <p className="font-bold text-slate-900 dark:text-slate-100 max-w-sm truncate">{file.name}</p>
                                  <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                                    {formatBytes(file.size)} | {file.type.split('/').pop()?.toUpperCase()} | Versé le {new Date(file.uploadDate).toLocaleDateString()}
                                  </p>
                                </div>
                              )}
                            </td>
                            
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`px-1.5 py-0.5 text-[9.5px] font-black uppercase rounded ${
                                  file.uploadedBy === 'admin'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/25 dark:text-amber-400'
                                    : 'bg-azur/10 text-azur border border-azur/20 dark:bg-azur/15'
                                }`}>
                                  👤 {file.uploadedBy === 'admin' ? "Coordinateur" : "Organisme"}
                                </span>
                                {file.uploadedBy === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const currentShare = file.sharedWithPartner !== false; // defaults to true
                                      try {
                                        await updateDoc(doc(db, 'files', file.id), {
                                          sharedWithPartner: !currentShare
                                        });
                                      } catch (err) {
                                        console.error("Error toggling share status", err);
                                      }
                                    }}
                                    className={`text-[9px] px-2 py-0.5 rounded-lg border font-bold pointer-events-auto transition-all cursor-pointer ${
                                      file.sharedWithPartner !== false
                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                                        : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-amber-500/15 hover:text-amber-600 hover:border-amber-500/30"
                                    }`}
                                  >
                                    {file.sharedWithPartner !== false ? "🔓 Partagé with Partner" : "🔒 Privé Coordinateur"}
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <select
                                value={file.submissionStatus || 'Pending'}
                                onChange={(e) => handleUpdateOrgFileStatus(file.id, e.target.value as SubmissionStatus)}
                                className={`text-[11px] font-extrabold p-1 rounded-lg border focus:outline-none ${
                                  (file.submissionStatus === 'Validated') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border-emerald-200' :
                                  (file.submissionStatus === 'Incomplete') ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 border-rose-200' :
                                  (file.submissionStatus === 'Under review') ? 'bg-azur-light dark:bg-azur/10 text-deep border-azur-pastel' :
                                  'bg-amber-50 dark:bg-slate-950 text-amber-700 border-amber-200'
                                }`}
                              >
                                <option value="Pending">⌛ En attente</option>
                                <option value="Under review">🔍 En cours d'analyse</option>
                                <option value="Validated">✓ Validé / Autorisé</option>
                                <option value="Incomplete">✗ Non-conforme / Inacceptable</option>
                              </select>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => handleStartRenaming(file)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                  title="Renommer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {file.fallbackDataUrl && (
                                  <a
                                    href={file.fallbackDataUrl}
                                    download={file.name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
                                    title="Consulter / Télécharger"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteOrgFile(file.id, file.name)}
                                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
          ) : (
            // --- FOLDER SELECTION LIST ---
            <div className="space-y-6 text-left">
              
              {/* Sub-header inside Modal */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-left">
                  <h4 className="text-sm font-display font-black text-deep dark:text-slate-500">📁 REPERTOIRES ASSOCIES ET JUSTIFICATIFS REGLEMENTAIRES</h4>
                  <p className="text-xs text-slate-400">Duffers de stockage virtuel contenant les récépissés de douane, assurances de bord et brevets de navigation.</p>
                </div>
                
                {/* Toggle Create Folder bar */}
                {!isCreatingOrgFolder ? (
                  <button
                    onClick={() => setIsCreatingOrgFolder(true)}
                    className="btn-asf text-xs px-4 py-2 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Nouveau Dossier
                  </button>
                ) : (
                  <form onSubmit={handleCreateOrgFolder} className="flex gap-2 w-full sm:w-auto text-left">
                    <input
                      type="text"
                      name="name"
                      placeholder="Nom du dossier..."
                      className="input-asf text-xs dark:bg-slate-950 dark:text-white font-medium"
                      required
                      maxLength={40}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl cursor-pointer"
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingOrgFolder(false)}
                      className="btn-secondary text-[11px] px-3 py-1.5"
                    >
                      Annuler
                    </button>
                  </form>
                )}
              </div>

              {/* Folder Grid Cards */}
              {orgFolders.length === 0 ? (
                <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/20 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <FolderIcon className="w-10 h-10 text-slate-300" />
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Aucun dossier créé pour cet organisme</p>
                    <span className="text-[10.5px] text-slate-400">Le partenaire n'a pas encore créé de dossiers. Créez des dossiers pour structurer son archivage d'accréditation.</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {orgFolders.map(folder => {
                    const folFiles = files.filter(f => f.folderId === folder.id);
                    return (
                      <div
                        key={folder.id}
                        onClick={() => setOrgOpenFolderId(folder.id)}
                        className="group p-5 bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 border border-slate-100 hover:border-azur/40 dark:border-slate-800 rounded-2xl shadow-xs cursor-pointer transition-all flex justify-between items-start relative overflow-hidden"
                      >
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <FolderIcon className="w-8 h-8 text-azur dark:text-azur-pastel animate-pulse duration-2000" />
                            {folder.createdBy === 'admin' ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-azur/10 text-azur dark:bg-azur/15 dark:text-azur-pastel border border-azur/20">
                                Admin
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                                Partenaire
                              </span>
                            )}
                          </div>
                          <p className="font-extrabold text-deep dark:text-slate-200 text-xs tracking-tight group-hover:text-azur dark:group-hover:text-azur-pastel transition-colors mt-2">{folder.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{folFiles.length} fichiers justificatifs</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrgFolder(folder.id, folder.name);
                          }}
                          className="text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 transition-colors rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-900/20 cursor-pointer z-20"
                          title="Supprimer ce dossier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute right-0 bottom-0 bg-azur w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Files uploaded at root block */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-left">
                <div className="text-left">
                  <h4 className="text-xs font-display font-black text-deep dark:text-white">📄 PIECES VERSES A LA RACINE (HORS DOSSIERS)</h4>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Fichiers uploadés par l'organisme sans dossier de classement associé.</span>
                </div>

                {files.filter(f => f.orgId === org.id && (!f.folderId || f.folderId === null)).length === 0 ? (
                  <div className="py-6 text-center text-slate-400 italic text-[11px] bg-slate-50/10 dark:bg-slate-950/10 border rounded-2xl border-dashed">
                    Aucun justificatif versé à la racine de l'espace.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <th className="px-4 py-3">Document</th>
                          <th className="px-4 py-3 w-32">Propriétaire</th>
                          <th className="px-4 py-3 w-40">Statut</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px] text-slate-700 dark:text-slate-300">
                        {files.filter(f => f.orgId === org.id && (!f.folderId || f.folderId === null)).map(file => (
                          <tr key={file.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="px-4 py-3 text-left">
                              <p className="font-bold text-slate-900 dark:text-slate-100 max-w-sm truncate">{file.name}</p>
                              <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                                {formatBytes(file.size)} | {file.type.split('/').pop()?.toUpperCase()} | Versé le {new Date(file.uploadDate).toLocaleDateString()}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-azur/10 dark:bg-azur/15 text-azur border border-azur/20 px-1.5 py-0.5 text-[9.5px] font-black uppercase rounded">
                                👤 Organisme
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={file.submissionStatus || 'Pending'}
                                onChange={(e) => handleUpdateOrgFileStatus(file.id, e.target.value as SubmissionStatus)}
                                className={`text-[11px] font-extrabold p-1 rounded-lg border focus:outline-none ${
                                  (file.submissionStatus === 'Validated') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border-emerald-200' :
                                  (file.submissionStatus === 'Incomplete') ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 border-rose-200' :
                                  (file.submissionStatus === 'Under review') ? 'bg-azur-light dark:bg-azur/10 text-deep border-azur-pastel' :
                                  'bg-amber-50 dark:bg-slate-950 text-amber-700 border-amber-200'
                                }`}
                              >
                                <option value="Pending">⌛ En attente</option>
                                <option value="Under review">🔍 En cours d'analyse</option>
                                <option value="Validated">✓ Validé / Autorisé</option>
                                <option value="Incomplete">✗ Non-conforme / Inacceptable</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                {file.fallbackDataUrl && (
                                  <a
                                    href={file.fallbackDataUrl}
                                    download={file.name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                    title="Consulter / Télécharger"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteOrgFile(file.id, file.name)}
                                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/30 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer and controls */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Système de Synchronisation Réseau d'ARCHIVAGE ASF
          </span>
          <button
            onClick={onClose}
            className="btn-secondary text-xs px-5 py-2.5 shrink-0"
          >
            Fermer le Cabinet
          </button>
        </div>

      </motion.div>
    </div>
  );
}
