import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import {
  MapPin,
  LogOut,
  Settings,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Search,
  Eye,
  ChevronDown,
  Upload,
  Trash2,
  Download,
  Pencil,
} from 'lucide-react';
import { Bell } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { subscribeAntenneSettings, saveAntenneSettings } from '../lib/antenneSettings';
import { logAction } from '../lib/auditLog';
import { readFileAsDataUrl, downloadFile, deleteFileArtifacts } from '../lib/fileTransfer';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { localDb } from '../lib/localDb';
import { DossierFile, Folder, Organization, SubmissionStatus } from '../types';
import { STATUS_ORDER, getStatusMeta } from '../lib/status';
import { StatusBadge } from './ui';
import { formatBytes } from '../lib/utils';
import { LogoASF } from './LandingPage';
import FilePreviewModal from './FilePreviewModal';
import UserProfileModal from './UserProfileModal';
import AuditLogPanel from './AuditLogPanel';

/**
 * Dashboard personnalisé d'un gestionnaire d'antenne (rôle `admin_antenne`).
 *
 * Strictement scoupé à l'antenne du compte (`organization.antenne_id` +
 * `delegation_id`) : il ne voit que les organismes, dossiers et documents de
 * son antenne et peut faire évoluer le statut des documents. Distinct du
 * panneau super admin.
 */
export default function AntenneAdminDashboard() {
  const { user, organization, signOut, antennes, delegations } = useAuth();
  const { toast } = useFeedback();

  const delegationId = organization?.delegation_id || '';
  const antenneId = organization?.antenne_id || '';

  const antenneName = useMemo(() => {
    const list = antennes[delegationId] || [];
    return list.find((a) => a.id === antenneId)?.name || antenneId || 'Antenne';
  }, [antennes, delegationId, antenneId]);

  const delegationName = useMemo(
    () => delegations.find((d) => d.id === delegationId)?.name || delegationId,
    [delegations, delegationId],
  );

  const [files, setFiles] = useState<DossierFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [orgProfiles, setOrgProfiles] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [previewFile, setPreviewFile] = useState<DossierFile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Gestion des fichiers (dépôt, renommage, suppression, partage).
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renamingFile, setRenamingFile] = useState<DossierFile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingFile, setDeletingFile] = useState<DossierFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<any>(null);

  // Réglages de notification e-mail de l'antenne.
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!antenneId) return;
    const unsub = subscribeAntenneSettings(antenneId, (s) => {
      setNotifyEnabled(s.notifyEnabled);
      setNotifyEmail(s.notifyEmail);
    });
    return unsub;
  }, [antenneId]);

  const handleSaveSettings = async () => {
    const email = notifyEmail.trim();
    if (notifyEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Veuillez saisir une adresse e-mail valide.', 'warning');
      return;
    }
    setSavingSettings(true);
    try {
      await saveAntenneSettings(antenneId, { notifyEnabled, notifyEmail: email });
      toast(
        notifyEnabled
          ? `Notifications activées vers ${email}.`
          : 'Notifications désactivées.',
        'success',
      );
    } catch (err: any) {
      console.error('Save antenne settings failed:', err);
      toast("Échec de l'enregistrement des réglages : " + (err?.message || 'erreur'), 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // --- Chargement des données scoupées à l'antenne ---
  useEffect(() => {
    if (!user || !antenneId) {
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      const all = localDb.getFiles().filter(
        (f) => f.antenne_id === antenneId && (!delegationId || f.delegation_id === delegationId),
      );
      const fol = localDb.getFolders().filter(
        (f) => f.antenne_id === antenneId && (!delegationId || f.delegation_id === delegationId),
      );
      const orgs = localDb.getOrganizations().filter((o) => o.antenne_id === antenneId);
      all.sort((a, b) => b.uploadDate - a.uploadDate);
      setFiles(all);
      setFolders(fol);
      setOrgProfiles(orgs);
      setLoading(false);
    };

    if (localDb.isSandboxActive()) {
      loadLocal();
      const onUpdate = () => localDb.isSandboxActive() && loadLocal();
      window.addEventListener('localdb-update', onUpdate);
      return () => window.removeEventListener('localdb-update', onUpdate);
    }

    const handleErr = (label: string) => (err: unknown) => {
      console.warn(`AntenneAdminDashboard ${label} subscription failed, fallback to sandbox:`, err);
      localDb.setSandboxActive(true);
      loadLocal();
    };

    const filesQ = query(
      collection(db, 'files'),
      where('delegation_id', '==', delegationId),
      where('antenne_id', '==', antenneId),
    );
    const foldersQ = query(
      collection(db, 'folders'),
      where('delegation_id', '==', delegationId),
      where('antenne_id', '==', antenneId),
    );
    const orgsQ = query(
      collection(db, 'organizations'),
      where('delegation_id', '==', delegationId),
      where('antenne_id', '==', antenneId),
    );

    const unsubFiles = onSnapshot(
      filesQ,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DossierFile);
        list.sort((a, b) => b.uploadDate - a.uploadDate);
        setFiles(list);
        setLoading(false);
      },
      handleErr('files'),
    );
    const unsubFolders = onSnapshot(
      foldersQ,
      (snap) => setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Folder)),
      handleErr('folders'),
    );
    const unsubOrgs = onSnapshot(
      orgsQ,
      (snap) => setOrgProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Organization)),
      handleErr('organizations'),
    );

    return () => {
      unsubFiles();
      unsubFolders();
      unsubOrgs();
    };
  }, [user, antenneId, delegationId]);

  // Organismes partenaires (on exclut les comptes admin de l'antenne)
  const partnerOrgs = useMemo(
    () => orgProfiles.filter((o) => o.role === 'organization'),
    [orgProfiles],
  );

  const stats = useMemo(() => {
    const by = (s: SubmissionStatus) => files.filter((f) => (f.submissionStatus || 'Pending') === s).length;
    const validated = by('Validated');
    const total = files.length;
    return {
      total,
      pending: by('Pending'),
      review: by('Under review'),
      validated,
      incomplete: by('Incomplete'),
      organisms: partnerOrgs.length,
      compliance: total > 0 ? Math.round((validated / total) * 100) : 0,
    };
  }, [files, partnerOrgs]);

  const visibleFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((f) => {
      const matchesSearch = !q || f.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || (f.submissionStatus || 'Pending') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [files, searchQuery, statusFilter]);

  const orgName = (orgId: string) =>
    orgProfiles.find((o) => o.id === orgId)?.name ||
    (orgId === 'admin_created' || orgId === 'public' ? 'Document interne' : 'Organisme');

  const handleUpdateStatus = async (file: DossierFile, newStatus: SubmissionStatus) => {
    const logIt = () => logAction('file_status_change', {
      targetType: 'file',
      targetId: file.id,
      targetName: file.name,
      antenne_id: file.antenne_id || antenneId,
      delegation_id: file.delegation_id || delegationId,
      details: `Statut du document : ${newStatus}`,
    });
    if (localDb.isSandboxActive()) {
      const target = localDb.getFiles().find((f) => f.id === file.id);
      if (target) {
        target.submissionStatus = newStatus;
        localDb.saveFile(target);
      }
      logIt();
      return;
    }
    try {
      await updateDoc(doc(db, 'files', file.id), {
        submissionStatus: newStatus,
      });
      logIt();
      toast(`Statut mis à jour : ${getStatusMeta(newStatus).label}`, 'success');
    } catch (err) {
      console.error('Update status failed:', err);
      toast("Impossible de mettre à jour le statut.", 'error');
    }
  };

  // --- Dépôt de fichiers dans l'antenne (par le gestionnaire) ---
  const handleUploadFiles = async (selected: File[]) => {
    if (!selected.length || !antenneId) return;
    setUploading(true);
    setUploadProgress(0);
    let ok = 0;
    try {
      for (const f of selected) {
        const meta = {
          orgId: 'admin_created',
          folderId: null as string | null,
          delegation_id: delegationId,
          antenne_id: antenneId,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          uploadDate: Date.now(),
          uploadedBy: 'admin' as const,
          submissionStatus: 'Pending' as SubmissionStatus,
          sharedWithPartner: true,
        };

        let uploaded = false;

        if (localDb.isSandboxActive()) {
          try {
            const dataUrl = await readFileAsDataUrl(f);
            localDb.saveFile({
              id: `mock_file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              ...meta,
              storagePath: 'sandbox',
              fallbackDataUrl: dataUrl,
            } as DossierFile);
            uploaded = true;
          } catch (e) {
            console.error('Lecture fichier (sandbox) échec:', e);
          }
        } else {
          const path = `delegations/${delegationId}/${antenneId}/${Date.now()}_${f.name}`;
          try {
            const task = uploadBytesResumable(storageRef(storage, path), f);
            await new Promise<void>((resolve, reject) => {
              task.on(
                'state_changed',
                (s) => setUploadProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
                reject,
                async () => {
                  try {
                    const url = await getDownloadURL(task.snapshot.ref);
                    await addDoc(collection(db, 'files'), { ...meta, storagePath: path, fallbackDataUrl: url });
                    resolve();
                  } catch (e) {
                    reject(e);
                  }
                },
              );
            });
            uploaded = true;
          } catch (err) {
            // Repli base64 si le Storage est indisponible.
            try {
              const dataUrl = await readFileAsDataUrl(f);
              await addDoc(collection(db, 'files'), { ...meta, storagePath: 'firestore_fallback', fallbackDataUrl: dataUrl });
              uploaded = true;
            } catch (e) {
              console.error('Upload échec:', e);
            }
          }
        }

        // On ne journalise que les dépôts réellement enregistrés.
        if (uploaded) {
          ok++;
          logAction('file_upload', {
            targetType: 'file',
            targetName: f.name,
            antenne_id: antenneId,
            delegation_id: delegationId,
            details: "Dépôt par le gestionnaire d'antenne",
          });
        }
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
    if (ok > 0) toast(`${ok} document(s) déposé(s) ✓`, 'success');
    if (ok < selected.length) toast(`${selected.length - ok} fichier(s) n'ont pas pu être envoyés.`, 'error');
    if (localDb.isSandboxActive()) loadLocalNow();
  };

  // Recharge immédiate des fichiers en mode sandbox.
  const loadLocalNow = () => {
    if (!antenneId) return;
    const all = localDb.getFiles().filter(
      (f) => f.antenne_id === antenneId && (!delegationId || f.delegation_id === delegationId),
    );
    all.sort((a, b) => b.uploadDate - a.uploadDate);
    setFiles(all);
  };

  // --- Téléchargement ---
  const handleDownload = async (file: DossierFile) => {
    try {
      const ok = await downloadFile(file);
      if (!ok) toast('Téléchargement indisponible pour ce fichier.', 'warning');
    } catch (err) {
      console.error('Download failed:', err);
      toast('Échec du téléchargement.', 'error');
    }
  };

  // --- Renommage ---
  const openRename = (file: DossierFile) => {
    setRenamingFile(file);
    setRenameValue(file.name);
  };
  const confirmRename = async () => {
    if (!renamingFile) return;
    const name = renameValue.trim();
    if (!name || name === renamingFile.name) {
      setRenamingFile(null);
      return;
    }
    const logIt = () => logAction('file_rename', {
      targetType: 'file',
      targetId: renamingFile.id,
      targetName: name,
      antenne_id: renamingFile.antenne_id || antenneId,
      delegation_id: renamingFile.delegation_id || delegationId,
      details: `Renommé : « ${renamingFile.name} » → « ${name} »`,
    });
    if (localDb.isSandboxActive()) {
      const t = localDb.getFiles().find((f) => f.id === renamingFile.id);
      if (t) { t.name = name; localDb.saveFile(t); }
      logIt();
      loadLocalNow();
      setRenamingFile(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'files', renamingFile.id), { name });
      logIt();
      toast('Fichier renommé.', 'success');
    } catch (err) {
      console.error('Rename failed:', err);
      toast('Échec du renommage.', 'error');
    }
    setRenamingFile(null);
  };

  // --- Partage avec le partenaire (fichiers déposés par un coordinateur) ---
  const handleToggleShare = async (file: DossierFile) => {
    const next = file.sharedWithPartner === false; // on bascule vers « partagé »
    const logIt = () => logAction('file_share_toggle', {
      targetType: 'file',
      targetId: file.id,
      targetName: file.name,
      antenne_id: file.antenne_id || antenneId,
      delegation_id: file.delegation_id || delegationId,
      details: next ? 'Fichier partagé avec le partenaire' : 'Fichier rendu privé (coordinateur)',
    });
    if (localDb.isSandboxActive()) {
      const t = localDb.getFiles().find((f) => f.id === file.id);
      if (t) { t.sharedWithPartner = next; localDb.saveFile(t); }
      logIt();
      loadLocalNow();
      return;
    }
    try {
      await updateDoc(doc(db, 'files', file.id), { sharedWithPartner: next });
      logIt();
    } catch (err) {
      console.error('Toggle share failed:', err);
      toast('Échec de la modification du partage.', 'error');
    }
  };

  // --- Suppression ---
  const confirmDelete = async () => {
    if (!deletingFile) return;
    setDeleting(true);
    const file = deletingFile;
    const logIt = () => logAction('file_delete', {
      targetType: 'file',
      targetId: file.id,
      targetName: file.name,
      antenne_id: file.antenne_id || antenneId,
      delegation_id: file.delegation_id || delegationId,
    });
    if (localDb.isSandboxActive()) {
      localDb.deleteFile(file.id);
      logIt();
      loadLocalNow();
      setDeleting(false);
      setDeletingFile(null);
      setPreviewFile(null);
      return;
    }
    try {
      await deleteFileArtifacts(file);
      await deleteDoc(doc(db, 'files', file.id));
      logIt();
      toast('Fichier supprimé.', 'success');
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast('Échec de la suppression : ' + (err?.message || 'erreur'), 'error');
    }
    setDeleting(false);
    setDeletingFile(null);
    setPreviewFile(null);
  };

  if (!organization) return null;

  const STAT_CARDS = [
    { label: 'Documents', value: stats.total, icon: FileText, tone: 'text-azur bg-azur/10' },
    { label: 'Organismes', value: stats.organisms, icon: Building2, tone: 'text-deep bg-azur-light' },
    { label: 'En attente', value: stats.pending, icon: Clock, tone: 'text-amber-600 bg-amber-50' },
    { label: 'En révision', value: stats.review, icon: AlertCircle, tone: 'text-azur bg-azur/10' },
    { label: 'Validés', value: stats.validated, icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
  ];

  // Un coordinateur d'antenne sans antenne affectée ne peut rien gérer : on
  // l'informe clairement au lieu d'afficher un tableau de bord vide.
  if (!antenneId) {
    return (
      <div className="min-h-screen bg-slate-50/60 text-slate-800 font-sans flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <MapPin className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="font-display text-xl font-bold text-deep">Aucune antenne affectée</h1>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">
          Votre compte de coordinateur n'est rattaché à aucune antenne pour le moment.
          Demandez au super administrateur de vous affecter une antenne de rattachement
          pour accéder à votre espace de gestion.
        </p>
        <button onClick={() => signOut()} className="btn-secondary text-sm mt-2">
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/70 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-azur-light flex items-center justify-center shrink-0">
            <LogoASF className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base sm:text-lg font-bold text-deep leading-tight truncate">
              Antenne {antenneName}
            </h1>
            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 text-azur" /> {delegationName} · Espace gestionnaire
            </p>
          </div>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="btn-ghost text-sm"
            title="Mon profil"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Profil</span>
          </button>
          <button onClick={() => signOut()} className="btn-secondary text-sm">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Bannière de conformité */}
        <div className="rounded-3xl bg-gradient-to-r from-deep via-azur to-deep-dark p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-azur-pastel font-bold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Taux de conformité
              </p>
              <p className="font-display text-4xl font-extrabold mt-1">{stats.compliance}%</p>
              <p className="text-sm text-white/80 mt-1">
                {stats.validated} document{stats.validated > 1 ? 's' : ''} validé{stats.validated > 1 ? 's' : ''} sur {stats.total}
              </p>
            </div>
            <div className="text-right text-sm text-white/80">
              <p className="font-bold text-white">{antenneName}</p>
              <p>{stats.organisms} organisme{stats.organisms > 1 ? 's' : ''} rattaché{stats.organisms > 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Cartes de stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_CARDS.map((c) => (
            <div key={c.label} className="card-asf p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${c.tone}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="font-display text-2xl font-bold text-deep">{c.value}</p>
              <p className="text-xs text-slate-500 font-medium">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Réglages : notification e-mail à chaque dépôt */}
        <section className="card-asf p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-deep font-bold tracking-tight">Notifications par e-mail</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Recevez un e-mail à chaque nouveau dossier ou fichier déposé par un partenaire de votre antenne.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
              className="w-4 h-4 accent-azur cursor-pointer"
            />
            <span className="text-sm font-semibold text-deep">Activer les notifications de dépôt</span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Adresse e-mail de notification
              </label>
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="prenom.nom@exemple.org"
                disabled={!notifyEnabled}
                className="input-asf text-sm w-full disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn-primary text-sm whitespace-nowrap disabled:opacity-60"
            >
              {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </section>

        {/* Organismes */}
        <section className="space-y-3">
          <h2 className="font-display text-deep font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-azur" /> Organismes de l'antenne
          </h2>
          {partnerOrgs.length === 0 ? (
            <div className="card-asf p-6 text-center text-sm text-slate-500">
              Aucun organisme rattaché à cette antenne pour le moment.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {partnerOrgs.map((org) => {
                const orgFiles = files.filter((f) => f.orgId === org.id);
                return (
                  <div key={org.id} className="card-asf p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-deep truncate">{org.name}</p>
                        <p className="text-xs text-slate-500 truncate">{org.email}</p>
                      </div>
                      <StatusBadge status={org.submissionStatus} />
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      {orgFiles.length} document{orgFiles.length > 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Documents */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-deep font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-azur" /> Documents
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className="input-asf pl-10 w-44 sm:w-56"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SubmissionStatus)}
                className="input-asf w-auto"
              >
                <option value="all">Tous les statuts</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{getStatusMeta(s).label}</option>
                ))}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const fs = e.target.files ? Array.from(e.target.files) : [];
                  if (fs.length) handleUploadFiles(fs as File[]);
                  if (e.target) (e.target as any).value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                disabled={uploading}
                className="btn-asf text-sm shrink-0 disabled:opacity-60"
                title="Déposer des documents dans l'antenne"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? `Envoi… ${uploadProgress}%` : 'Déposer'}</span>
              </button>
            </div>
          </div>

          <div className="card-asf overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">Chargement des documents…</div>
            ) : visibleFiles.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">Aucun document à afficher.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-azur/10 text-azur flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="font-medium text-slate-800 hover:text-azur truncate block text-left w-full"
                      >
                        {file.name}
                      </button>
                      <p className="text-xs text-slate-500 truncate">
                        {orgName(file.orgId)} · {formatBytes(file.size)} · {new Date(file.uploadDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {/* Sélecteur de statut */}
                    <div className="relative shrink-0">
                      <select
                        value={file.submissionStatus || 'Pending'}
                        onChange={(e) => handleUpdateStatus(file, e.target.value as SubmissionStatus)}
                        className="appearance-none cursor-pointer text-xs font-semibold rounded-full border border-slate-200 bg-white pl-3 pr-7 py-1.5 text-slate-700 focus:outline-none focus:border-azur"
                        title="Changer le statut"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>{getStatusMeta(s).label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Partage avec le partenaire (uniquement pour les dépôts coordinateur) */}
                    {file.uploadedBy === 'admin' && (
                      <button
                        onClick={() => handleToggleShare(file)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 transition-colors ${
                          file.sharedWithPartner !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                        title={file.sharedWithPartner !== false ? 'Partagé avec le partenaire (cliquer pour rendre privé)' : 'Privé coordinateur (cliquer pour partager)'}
                      >
                        {file.sharedWithPartner !== false ? '🔓 Partagé' : '🔒 Privé'}
                      </button>
                    )}

                    <button onClick={() => setPreviewFile(file)} className="btn-ghost p-2 shrink-0" title="Aperçu">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDownload(file)} className="btn-ghost p-2 shrink-0" title="Télécharger">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => openRename(file)} className="btn-ghost p-2 shrink-0" title="Renommer">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingFile(file)}
                      className="btn-ghost p-2 shrink-0 text-rose-500 hover:bg-rose-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Journal d'activité de l'antenne */}
        <section className="mt-8">
          <AuditLogPanel
            antenneId={antenneId}
            title="Journal d'activité de l'antenne"
            subtitle={`Toutes les actions des comptes rattachés à l'antenne ${antenneName}.`}
          />
        </section>
      </main>

      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
        orgName={previewFile ? orgName(previewFile.orgId) : undefined}
        isAdmin={true}
        onDelete={(f) => setDeletingFile(f)}
      />

      {/* Modale de renommage */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setRenamingFile(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-deep">Renommer le document</h3>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); }}
              className="input-asf w-full"
              placeholder="Nouveau nom du fichier"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenamingFile(null)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={confirmRename} className="btn-asf text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de suppression */}
      {deletingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !deleting && setDeletingFile(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-deep">Supprimer le document ?</h3>
                <p className="text-sm text-slate-500">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 truncate">
              📄 {deletingFile.name}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingFile(null)} disabled={deleting} className="btn-secondary text-sm disabled:opacity-60">Annuler</button>
              <button onClick={confirmDelete} disabled={deleting} className="btn-danger text-sm disabled:opacity-60">
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
