import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronRight,
  ChevronLeft,
  Upload,
  Trash2,
  Download,
  Pencil,
  X,
  Mail,
  Phone,
  User,
  Folder as FolderIcon,
  FolderPlus,
  FolderOpen,
  FileDown,
  CheckCheck,
  CloudUpload,
  Send,
  Archive,
} from 'lucide-react';
import { Bell, GraduationCap, MessageSquare } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { subscribeAntenneSettings, saveAntenneSettings } from '../lib/antenneSettings';
import { queueEmail } from '../lib/antenneAdmins';
import { logAction, subscribeAuditLogs } from '../lib/auditLog';
import { useCmdK } from '../hooks/useCmdK';
import { useFirstRunTour } from '../hooks/useFirstRunTour';
import { readFileAsDataUrl, downloadFile, deleteFileArtifacts } from '../lib/fileTransfer';
import { downloadFilesAsZip } from '../lib/zip';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { localDb } from '../lib/localDb';
import { DossierFile, Folder, Organization, SubmissionStatus } from '../types';
import { STATUS_ORDER, getStatusMeta } from '../lib/status';
import { StatusBadge, ComplianceBar, GuidedTour, StatusFilterChips, type TourStep } from './ui';
import { formatBytes } from '../lib/utils';
import { LogoASF } from './LandingPage';
import FilePreviewModal from './FilePreviewModal';
import UserProfileModal from './UserProfileModal';
import AuditLogPanel from './AuditLogPanel';
import CessnaPlane from './CessnaPlane';

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
  const { toast, confirm } = useFeedback();

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
  // Dossiers
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  // Organisme cible d'un nouveau dossier (null = dossier interne d'antenne).
  const [folderTargetOrgId, setFolderTargetOrgId] = useState<string | null>(null);
  // Dossier actif DANS la fiche d'un organisme (rangement par organisme).
  const [orgFolderId, setOrgFolderId] = useState<string | null>(null);
  // Téléchargement groupé en .zip en cours.
  const [zipping, setZipping] = useState(false);
  // Onglet actif du tableau de bord (réduit la longueur de la page).
  const [view, setView] = useState<'workspace' | 'activity' | 'settings'>('workspace');
  // Tri, filtre par organisme, sélection multiple, glisser-déposer
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name' | 'status' | 'size'>('date_desc');
  // Documents internes de l'antenne (non rattachés à un organisme).
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [orgDocSearch, setOrgDocSearch] = useState('');
  // Filtre statut + tri propres à la fiche organisme.
  const [orgStatusFilter, setOrgStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [orgSortBy, setOrgSortBy] = useState<'date_desc' | 'date_asc' | 'name' | 'status' | 'size'>('date_desc');
  const [previewFile, setPreviewFile] = useState<DossierFile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTour, setActiveTour] = useState<TourStep[] | null>(null);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgQuickStatus, setOrgQuickStatus] = useState<'all' | SubmissionStatus>('all');
  const orgSearchRef = useRef<HTMLInputElement | null>(null);
  // Fiche détaillée d'un organisme (ses fichiers + gestion de son compte).
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [updatingOrgStatus, setUpdatingOrgStatus] = useState(false);
  const orgUploadRef = useRef<any>(null);

  // --- Notifications « nouveau » (par admin) -------------------------------
  // Un fichier déposé/modifié ou un dossier créé par l'organisme, ainsi qu'un
  // dossier fraîchement soumis, s'entourent de rouge tant que l'admin n'a pas
  // cliqué dessus. L'état « vu » est mémorisé localement (par antenne/admin) :
  // aucune écriture Firestore, aucun déploiement de règles requis.
  const seenKey = `asf_antenne_seen_${user?.uid || antenneId || 'anon'}`;
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
  // Un élément est « nouveau » si son horodatage (dépôt/modif/soumission) est
  // postérieur à la dernière consultation (ou à la mise en service du suivi).
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
  // Horodatage de « nouveauté » d'un fichier : dépôt ou dernière modification.
  const fileStamp = (f: DossierFile) => Math.max(f.uploadDate || 0, (f as any).updatedAt || 0);

  // Gestion des fichiers (dépôt, renommage, suppression, partage).
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renamingFile, setRenamingFile] = useState<DossierFile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingFile, setDeletingFile] = useState<DossierFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<any>(null);
  // Note de revue d'un fichier (ce que l'organisme doit corriger).
  const [noteFile, setNoteFile] = useState<DossierFile | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState(false);

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
      logAction('antenne_settings_change', {
        targetType: 'antenne',
        targetId: antenneId,
        targetName: antenneName,
        antenne_id: antenneId,
        delegation_id: delegationId,
        details: notifyEnabled ? `Notifications activées vers ${email}` : 'Notifications désactivées',
      });
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

  // Notifications de soumission de dossier. Pour rester fonctionnel même sans
  // déploiement des règles, on s'appuie sur le journal d'activité (action
  // autorisée) : un dépôt est repéré via `targetType === 'dossier_submission'`
  // ou l'action `dossier_submit`. On retient l'horodatage le plus récent par
  // organisme.
  const [submittedMap, setSubmittedMap] = useState<Record<string, number>>({});
  // Suivi pour repérer une soumission FRAÎCHE (toast) sans rejouer l'historique.
  const seenRef = useRef(seen);
  useEffect(() => { seenRef.current = seen; }, [seen]);
  const prevSubsRef = useRef<Record<string, number> | null>(null);
  // Instant de montage : on ne notifie (toast) que des soumissions postérieures,
  // jamais l'historique rejoué au chargement.
  const mountTimeRef = useRef(Date.now());
  useEffect(() => {
    if (!antenneId) return;
    const unsub = subscribeAuditLogs({ antenneId }, (logs) => {
      const m: Record<string, number> = {};
      const nameById: Record<string, string> = {};
      for (const l of logs) {
        const isSubmit = l.action === 'dossier_submit' || l.targetType === 'dossier_submission';
        if (!isSubmit) continue;
        const oid = l.targetId || l.actorUid;
        if (!oid) continue;
        if (!m[oid] || (l.timestamp || 0) > m[oid]) m[oid] = l.timestamp || 0;
        if (l.targetName) nameById[oid] = l.targetName;
      }
      // Notifie d'une soumission réellement nouvelle (après le 1er chargement).
      const prev = prevSubsRef.current;
      if (prev) {
        for (const oid of Object.keys(m)) {
          const ts = m[oid];
          const isFresh = ts > (prev[oid] || 0);
          const isUnread = ts > (seenRef.current.items[oid] ?? seenRef.current.baseline);
          if (isFresh && isUnread && ts >= mountTimeRef.current) {
            toast(`📥 ${nameById[oid] || 'Un organisme'} a soumis son dossier pour revue`, 'info');
          }
        }
      }
      prevSubsRef.current = m;
      setSubmittedMap(m);
    }, 500);
    return unsub;
  }, [antenneId, toast]);

  // Dossiers soumis « à traiter » : organismes ayant soumis (journal ou champ
  // `dossierSubmittedAt`) et dont le compte n'est pas encore tranché
  // (ni validé, ni marqué incomplet). Triés du plus récent au plus ancien.
  const pendingSubmissions = useMemo(() => {
    return partnerOrgs
      .map((o) => ({ org: o, at: submittedMap[o.id] || o.dossierSubmittedAt || 0 }))
      .filter(({ org, at }) => {
        if (!at) return false;
        const st = org.submissionStatus || 'Pending';
        return st !== 'Validated' && st !== 'Incomplete';
      })
      .sort((a, b) => b.at - a.at);
  }, [partnerOrgs, submittedMap]);

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

  // Recherche + filtre rapide par statut sur la liste des organismes.
  const orgStatusCounts = useMemo(() => {
    const c: Record<string, number> = { all: partnerOrgs.length };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const o of partnerOrgs) {
      const st = (o.submissionStatus || 'Pending') as SubmissionStatus;
      c[st] = (c[st] || 0) + 1;
    }
    return c;
  }, [partnerOrgs]);

  const filteredPartnerOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    return partnerOrgs.filter(
      (o) =>
        (orgQuickStatus === 'all' || (o.submissionStatus || 'Pending') === orgQuickStatus) &&
        (!q ||
          (o.name || '').toLowerCase().includes(q) ||
          (o.email || '').toLowerCase().includes(q) ||
          (o.contactName || '').toLowerCase().includes(q)),
    );
  }, [partnerOrgs, orgSearch, orgQuickStatus]);

  // Raccourci clavier ⌘K / Ctrl+K : focus la recherche d'organismes.
  useCmdK(() => {
    setView('workspace');
    setTimeout(() => orgSearchRef.current && orgSearchRef.current.focus(), 60);
  });

  // Étapes communes à toutes les pages.
  const tourIntro: TourStep[] = [
    { target: '[data-tour="tutoriel"]', title: 'Le bouton Tutoriel', text: "Toujours ici, en haut à droite. Il s'adapte à la page affichée : relancez-le sur chaque onglet pour découvrir ses options." },
    { target: '[data-tour="kpi"]', title: 'Vos chiffres clés', text: "Taux de conformité, documents déposés et organismes rattachés, en un coup d'œil." },
    { target: '[data-tour="tabs"]', title: 'Navigation', text: "Basculez entre l'espace de travail, le journal d'activité et les réglages de l'antenne." },
  ];
  const tourByView: Record<typeof view, TourStep[]> = {
    workspace: [
      ...tourIntro,
      { target: '[data-tour="filters"]', title: 'Recherche et filtres', text: "Retrouvez un organisme par son nom (raccourci ⌘K / Ctrl+K) ou filtrez la liste par statut." },
      { target: '[data-tour="orgs"]', title: 'Vos organismes', text: "Chaque carte affiche la conformité du dossier. Cliquez dessus pour gérer ses dossiers et valider ses documents." },
      { target: '[data-tour="internal"]', title: 'Documents internes', text: "L'espace de l'antenne pour les documents qui ne concernent aucun organisme en particulier." },
    ],
    activity: [
      ...tourIntro,
      { target: '[data-tour="journal"]', title: "Journal d'activité", text: "L'historique précis de toutes les actions de l'antenne : dépôts, validations, renommages, suppressions… Filtrez par catégorie pour enquêter rapidement." },
    ],
    settings: [
      ...tourIntro,
      { target: '[data-tour="settings-notify"]', title: 'Notifications par e-mail', text: "Activez un e-mail automatique à chaque nouveau dépôt d'un organisme et choisissez l'adresse destinataire." },
    ],
  };
  const startTour = () => setActiveTour(tourByView[view]);

  // Lance automatiquement la visite à la TOUTE première connexion du compte.
  useFirstRunTour(organization, () => { setView('workspace'); setActiveTour(tourByView.workspace); });

  // Visite guidée de la fiche organisme (depuis la modale), détaillée sur un
  // exemple concret de document si l'organisme en a déposé.
  const selectedOrgAll = selectedOrgId ? files.filter((f) => f.orgId === selectedOrgId) : [];
  const orgDocStep: TourStep[] = selectedOrgAll.length > 0
    ? [
        { target: '[data-tour="org-doc"]', title: 'Un document (exemple)', text: "Prenons le premier document de l'organisme. Le nom est cliquable pour l'aperçu ; à droite, ses actions." },
        { target: '[data-tour="org-doc-validate"]', title: 'Valider / changer le statut', text: "Ce menu change le statut du document : passez-le en « Validé », « En révision » ou « Incomplet » — c'est ce qui fait avancer la conformité." },
      ]
    : [
        { target: '[data-tour="org-list"]', title: 'Les documents', text: "Les documents déposés par l'organisme apparaîtront ici. Vous pourrez les prévisualiser, télécharger, renommer et changer leur statut." },
      ];
  const orgModalTour: TourStep[] = [
    { target: '[data-tour="org-email"]', title: "L'e-mail de l'organisme", text: "L'adresse de contact : celle utilisée par l'organisme pour se connecter et recevoir les relances que vous envoyez." },
    { target: '[data-tour="org-access"]', title: "Gérer l'accès", text: "« Valider le compte » autorise l'organisme à se connecter et déposer ; « Suspendre » bloque tout nouveau dépôt." },
    { target: '[data-tour="org-folders"]', title: 'Les dossiers', text: "Rangez les documents dans des dossiers. Les nouveaux dépôts iront dans le dossier sélectionné." },
    { target: '[data-tour="org-tools"]', title: 'Recherche et actions', text: "Recherchez, filtrez, déposez un document, validez tout, exportez en CSV ou téléchargez en .zip." },
    ...orgDocStep,
  ];

  // Visite guidée des documents internes (depuis la modale).
  const internalModalTour: TourStep[] = [
    { target: '[data-tour="int-folders"]', title: 'Les dossiers internes', text: "Organisez les documents de l'antenne dans des dossiers dédiés." },
    { target: '[data-tour="int-tools"]', title: 'Recherche et actions', text: "Recherchez, filtrez, déposez (ou glissez-déposez), validez tout, exportez ou archivez en .zip." },
    { target: '[data-tour="int-list"]', title: 'Les documents', text: "La liste des documents internes, avec sélection multiple et actions groupées." },
  ];

  const orgModalFiles = useMemo(() => {
    if (!selectedOrgId) return [];
    const q = orgDocSearch.trim().toLowerCase();
    const rank: Record<string, number> = { Pending: 0, 'Under review': 1, Incomplete: 2, Validated: 3 };
    const list = files.filter(
      (f) =>
        f.orgId === selectedOrgId &&
        ((f.folderId || null) === orgFolderId) &&
        (orgStatusFilter === 'all' || (f.submissionStatus || 'Pending') === orgStatusFilter) &&
        (!q || f.name.toLowerCase().includes(q)),
    );
    list.sort((a, b) => {
      switch (orgSortBy) {
        case 'date_asc': return a.uploadDate - b.uploadDate;
        case 'name': return a.name.localeCompare(b.name, 'fr');
        case 'size': return b.size - a.size;
        case 'status': return (rank[a.submissionStatus || 'Pending'] ?? 0) - (rank[b.submissionStatus || 'Pending'] ?? 0);
        default: return b.uploadDate - a.uploadDate;
      }
    });
    return list;
  }, [files, selectedOrgId, orgDocSearch, orgFolderId, orgStatusFilter, orgSortBy]);

  // Dossiers propres à l'organisme affiché (rangement privé par organisme).
  const orgFolders = useMemo(
    () => (selectedOrgId ? folders.filter((f) => f.orgId === selectedOrgId) : []),
    [folders, selectedOrgId],
  );

  const folderFileCount = (folderId: string) => files.filter((f) => (f.folderId || null) === folderId).length;

  // Documents internes de l'antenne (non rattachés à un organisme partenaire).
  const internalAll = useMemo(
    () => files.filter((f) => f.orgId === 'admin_created' || f.orgId === 'public'),
    [files],
  );
  const internalFolders = useMemo(
    () => folders.filter((f) => f.orgId === 'admin_created' || f.orgId === 'public'),
    [folders],
  );
  const internalFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rank: Record<string, number> = { Pending: 0, 'Under review': 1, Incomplete: 2, Validated: 3 };
    const list = internalAll.filter((f) =>
      (!activeFolderId || (f.folderId || null) === activeFolderId) &&
      (statusFilter === 'all' || (f.submissionStatus || 'Pending') === statusFilter) &&
      (!q || f.name.toLowerCase().includes(q)),
    );
    list.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return a.uploadDate - b.uploadDate;
        case 'name': return a.name.localeCompare(b.name, 'fr');
        case 'size': return b.size - a.size;
        case 'status': return (rank[a.submissionStatus || 'Pending'] ?? 0) - (rank[b.submissionStatus || 'Pending'] ?? 0);
        default: return b.uploadDate - a.uploadDate;
      }
    });
    return list;
  }, [internalAll, searchQuery, statusFilter, sortBy, activeFolderId]);

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

  const openNote = (file: DossierFile) => {
    setNoteFile(file);
    setNoteValue(file.reviewNote || '');
  };

  // Enregistre (ou efface) la note de revue d'un fichier. La note est lisible
  // par l'organisme propriétaire : c'est le canal « ce qu'il faut corriger ».
  const saveNote = async () => {
    if (!noteFile) return;
    setSavingNote(true);
    const note = noteValue.trim();
    const logIt = () => logAction('file_status_change', {
      targetType: 'file',
      targetId: noteFile.id,
      targetName: noteFile.name,
      antenne_id: noteFile.antenne_id || antenneId,
      delegation_id: noteFile.delegation_id || delegationId,
      details: note ? `Note de revue : ${note}` : 'Note de revue effacée',
    });
    if (localDb.isSandboxActive()) {
      const target = localDb.getFiles().find((f) => f.id === noteFile.id);
      if (target) { (target as any).reviewNote = note; localDb.saveFile(target); }
      logIt();
      setNoteFile(null);
      setSavingNote(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'files', noteFile.id), { reviewNote: note });
      logIt();
      toast(note ? 'Note enregistrée.' : 'Note effacée.', 'success');
      setNoteFile(null);
    } catch (err) {
      console.error('Save note failed:', err);
      toast("Impossible d'enregistrer la note.", 'error');
    } finally {
      setSavingNote(false);
    }
  };

  // --- Statut du COMPTE d'un organisme (valider / suspendre, etc.) ---
  // Un organisme doit être « Validé » pour pouvoir déposer des fichiers
  // lui-même : c'est ce levier qui autorise/bloque ses dépôts.
  const handleUpdateOrgStatus = async (org: Organization, newStatus: SubmissionStatus) => {
    setUpdatingOrgStatus(true);
    const logIt = () => logAction('org_status_change', {
      targetType: 'organization',
      targetId: org.id,
      targetName: org.name,
      antenne_id: org.antenne_id || antenneId,
      delegation_id: org.delegation_id || delegationId,
      details: `Statut du compte : ${getStatusMeta(newStatus).label}`,
    });
    if (localDb.isSandboxActive()) {
      const t = localDb.getOrganizations().find((o) => o.id === org.id);
      if (t) { (t as any).submissionStatus = newStatus; localDb.saveOrganization(t as any); }
      setOrgProfiles((prev) => prev.map((o) => (o.id === org.id ? { ...o, submissionStatus: newStatus } : o)));
      logIt();
      setUpdatingOrgStatus(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', org.id), {
        submissionStatus: newStatus,
        updatedAt: Date.now(),
      });
      logIt();
      toast(`Compte « ${org.name} » : ${getStatusMeta(newStatus).label}`, 'success');
    } catch (err: any) {
      console.error('Update org status failed:', err);
      toast("Impossible de mettre à jour le statut du compte : " + (err?.message || 'erreur'), 'error');
    } finally {
      setUpdatingOrgStatus(false);
    }
  };

  // --- Dépôt de fichiers dans l'antenne (par le gestionnaire) ---
  // `targetOrgId` : si fourni, le document est rattaché à cet organisme
  // (dépôt depuis sa fiche) ; sinon document interne de l'antenne.
  const handleUploadFiles = async (selected: File[], targetOrgId?: string, targetFolderId?: string | null) => {
    if (!selected.length || !antenneId) return;
    setUploading(true);
    setUploadProgress(0);
    let ok = 0;
    try {
      for (const f of selected) {
        const meta = {
          orgId: targetOrgId || 'admin_created',
          folderId: (targetOrgId ? (targetFolderId ?? null) : activeFolderId) as string | null,
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

  // --- Dossiers ---
  const reloadFoldersLocal = () => {
    setFolders(
      localDb.getFolders().filter((f) => f.antenne_id === antenneId && (!delegationId || f.delegation_id === delegationId)),
    );
  };

  const handleCreateFolder = async () => {
    const name = folderName.trim();
    if (!name || !antenneId) return;
    // Dossier rattaché à un organisme précis (visible uniquement par lui) ou
    // dossier interne d'antenne (orgId = 'admin_created').
    const orgTarget = folderTargetOrgId || 'admin_created';
    const meta = {
      orgId: orgTarget,
      name,
      createdAt: Date.now(),
      createdBy: 'admin' as const,
      delegation_id: delegationId,
      antenne_id: antenneId,
    };
    const logIt = () => logAction('folder_create', {
      targetType: 'folder',
      targetName: name,
      antenne_id: antenneId,
      delegation_id: delegationId,
      details: folderTargetOrgId ? `Dossier pour « ${orgName(folderTargetOrgId)} »` : undefined,
    });
    if (localDb.isSandboxActive()) {
      localDb.saveFolder({ id: `mock_folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...meta } as Folder);
      logIt();
      reloadFoldersLocal();
      setFolderName('');
      setCreatingFolder(false);
      setFolderTargetOrgId(null);
      return;
    }
    try {
      await addDoc(collection(db, 'folders'), meta);
      logIt();
      toast('Dossier créé.', 'success');
    } catch (err: any) {
      console.error('Create folder failed:', err);
      toast('Échec de la création du dossier : ' + (err?.message || 'erreur'), 'error');
    }
    setFolderName('');
    setCreatingFolder(false);
    setFolderTargetOrgId(null);
  };

  const handleDeleteFolder = async (folder: Folder) => {
    const ok = await confirm(`Supprimer le dossier « ${folder.name} » ? Les documents qu'il contient ne sont pas supprimés (ils reviennent à la racine).`);
    if (!ok) return;
    const logIt = () => logAction('folder_delete', {
      targetType: 'folder',
      targetId: folder.id,
      targetName: folder.name,
      antenne_id: folder.antenne_id || antenneId,
      delegation_id: folder.delegation_id || delegationId,
    });
    if (activeFolderId === folder.id) setActiveFolderId(null);
    if (localDb.isSandboxActive()) {
      localDb.deleteFolder(folder.id);
      logIt();
      reloadFoldersLocal();
      return;
    }
    try {
      await deleteDoc(doc(db, 'folders', folder.id));
      logIt();
      toast('Dossier supprimé.', 'success');
    } catch (err: any) {
      console.error('Delete folder failed:', err);
      toast('Échec de la suppression du dossier : ' + (err?.message || 'erreur'), 'error');
    }
  };

  // --- Téléchargement ---
  const handleDownload = async (file: DossierFile) => {
    try {
      const ok = await downloadFile(file);
      if (ok) {
        logAction('file_download', {
          targetType: 'file',
          targetId: file.id,
          targetName: file.name,
          antenne_id: file.antenne_id || antenneId,
          delegation_id: file.delegation_id || delegationId,
        });
      } else {
        toast('Téléchargement indisponible pour ce fichier.', 'warning');
      }
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

  // --- Sélection multiple ---
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectedFiles = files.filter((f) => selectedIds.has(f.id));

  // --- Actions groupées (réutilisables : sélection ET fiche organisme) ---
  const applyStatusToFiles = async (targets: DossierFile[], status: SubmissionStatus) => {
    if (!targets.length) return;
    const log = (f: DossierFile) => logAction('file_status_change', {
      targetType: 'file', targetId: f.id, targetName: f.name,
      antenne_id: f.antenne_id || antenneId, delegation_id: f.delegation_id || delegationId,
      details: `Statut du document : ${getStatusMeta(status).label}`,
    });
    if (localDb.isSandboxActive()) {
      targets.forEach((f) => {
        const t = localDb.getFiles().find((x) => x.id === f.id);
        if (t) { t.submissionStatus = status; localDb.saveFile(t); }
        log(f);
      });
      loadLocalNow();
      toast(`${targets.length} document(s) → ${getStatusMeta(status).label}`, 'success');
      return;
    }
    let ok = 0;
    for (const f of targets) {
      try { await updateDoc(doc(db, 'files', f.id), { submissionStatus: status }); log(f); ok++; }
      catch (e) { console.error('bulk status failed', e); }
    }
    toast(`${ok} document(s) → ${getStatusMeta(status).label}`, ok ? 'success' : 'error');
  };

  const deleteFiles = async (targets: DossierFile[]) => {
    if (!targets.length) return;
    const log = (f: DossierFile) => logAction('file_delete', {
      targetType: 'file', targetId: f.id, targetName: f.name,
      antenne_id: f.antenne_id || antenneId, delegation_id: f.delegation_id || delegationId,
    });
    if (localDb.isSandboxActive()) {
      targets.forEach((f) => { localDb.deleteFile(f.id); log(f); });
      loadLocalNow();
      toast(`${targets.length} document(s) supprimé(s).`, 'success');
      return;
    }
    let ok = 0;
    for (const f of targets) {
      try { await deleteFileArtifacts(f); await deleteDoc(doc(db, 'files', f.id)); log(f); ok++; }
      catch (e) { console.error('bulk delete failed', e); }
    }
    toast(`${ok} document(s) supprimé(s).`, ok ? 'success' : 'error');
  };

  // --- Téléchargement groupé en archive .zip ---
  const downloadAsZip = async (targets: DossierFile[], zipName: string) => {
    if (!targets.length) return;
    if (targets.length === 1) { await downloadFile(targets[0]); return; }
    setZipping(true);
    try {
      const { zipped, failed } = await downloadFilesAsZip(targets, zipName);
      if (zipped > 0 && failed.length === 0) {
        toast(`Archive de ${zipped} document(s) téléchargée ✓`, 'success');
      } else if (zipped > 0 && failed.length > 0) {
        toast(`${zipped} document(s) dans l'archive · ${failed.length} téléchargé(s) séparément.`, 'warning');
      } else {
        toast('Aucun document n\'a pu être archivé ; téléchargement séparé.', 'warning');
      }
    } catch (e) {
      console.error('zip failed', e);
      toast('Échec de la création de l\'archive.', 'error');
    } finally {
      setZipping(false);
    }
  };

  // --- Relance d'un organisme par e-mail (texte modifiable avant envoi) ---
  // Envoi réel via EmailJS / extension Firebase (queueEmail) ; si l'envoi
  // n'aboutit pas (non configuré, mode sandbox), repli sur le client e-mail.
  const [reminding, setReminding] = useState(false);
  const [reminderOrg, setReminderOrg] = useState<Organization | null>(null);
  const [reminderSubject, setReminderSubject] = useState('');
  const [reminderBody, setReminderBody] = useState('');

  // Ouvre l'éditeur de relance avec un texte pré-rempli (modifiable).
  const openReminder = (org: Organization) => {
    if (!org.email) {
      toast("Cet organisme n'a pas d'adresse e-mail renseignée.", 'warning');
      return;
    }
    const orgFiles = files.filter((f) => f.orgId === org.id);
    const missing = orgFiles.filter((f) => (f.submissionStatus || 'Pending') !== 'Validated').length;
    const intro = orgFiles.length === 0
      ? 'nous vous invitons à déposer vos documents sur votre espace en ligne.'
      : missing > 0
        ? `il reste ${missing} document(s) à compléter ou à valider. Merci de vous connecter à votre espace pour les régulariser.`
        : 'nous vous remercions pour les documents transmis.';
    const portal = 'https://asf-sud-est.vercel.app';
    setReminderSubject(`Aviation Sans Frontières — Suivi de votre dossier (antenne ${antenneName})`);
    setReminderBody(
      `Bonjour ${org.contactName || ''},\n\n` +
      `Dans le cadre du suivi de votre dossier auprès de l'antenne ${antenneName} (${delegationName}), ${intro}\n\n` +
      `Vous pouvez accéder à votre espace ici : ${portal}\n\n` +
      `Bien cordialement,\nL'équipe de l'antenne ${antenneName}`,
    );
    setReminderOrg(org);
  };

  // Envoie la relance avec le texte (éventuellement modifié) de l'éditeur.
  const sendReminder = async () => {
    const org = reminderOrg;
    if (!org || !org.email) return;
    const subject = reminderSubject.trim() || 'Suivi de votre dossier';
    const text = reminderBody;
    const html = text
      .split('\n')
      .map((line) => (line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px">${line}</p>`))
      .join('');

    const logIt = (sent: boolean) => logAction('org_reminder', {
      targetType: 'organization',
      targetId: org.id,
      targetName: org.name,
      antenne_id: org.antenne_id || antenneId,
      delegation_id: org.delegation_id || delegationId,
      details: 'Relance' + (sent ? ' (e-mail envoyé)' : ' (client e-mail ouvert)'),
    });

    setReminding(true);
    try {
      const sent = await queueEmail(org.email, subject, text, html);
      if (sent) {
        logIt(true);
        toast(`E-mail de relance envoyé à ${org.name}.`, 'success');
      } else {
        window.location.href = `mailto:${encodeURIComponent(org.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        logIt(false);
        toast(`Relance préparée pour ${org.name}.`, 'success');
      }
    } catch (e) {
      console.error('reminder failed', e);
      window.location.href = `mailto:${encodeURIComponent(org.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      logIt(false);
    } finally {
      setReminding(false);
      setReminderOrg(null);
    }
  };

  // --- Validation / suspension du COMPTE (booléen, pas un statut de fichier) ---
  const handleSetOrgValidated = (org: Organization, validated: boolean) =>
    handleUpdateOrgStatus(org, validated ? 'Validated' : 'Pending');

  // Ouverture / fermeture de la fiche organisme (réinitialise les filtres internes).
  const openOrg = (id: string) => {
    markSeen(id); // consulter la fiche efface la notification de soumission
    setSelectedOrgId(id); setOrgFolderId(null); setOrgDocSearch('');
    setOrgStatusFilter('all'); setOrgSortBy('date_desc'); clearSelection();
  };
  const closeOrg = () => {
    setSelectedOrgId(null); setOrgFolderId(null); setOrgDocSearch('');
    setOrgStatusFilter('all'); setOrgSortBy('date_desc'); clearSelection();
  };

  // Ouverture / fermeture du gestionnaire de documents internes (réutilise les
  // filtres « globaux » : recherche, statut, tri, dossier actif).
  const openInternal = () => {
    setInternalOpen(true); setActiveFolderId(null); setSearchQuery('');
    setStatusFilter('all'); setSortBy('date_desc'); clearSelection();
  };
  const closeInternal = () => {
    setInternalOpen(false); setActiveFolderId(null); setSearchQuery('');
    setStatusFilter('all'); setSortBy('date_desc'); clearSelection();
  };

  const handleBulkStatus = async (status: SubmissionStatus) => { await applyStatusToFiles(selectedFiles, status); clearSelection(); };
  const handleBulkDownload = async () => { await downloadAsZip(selectedFiles, `documents_${antenneName}_${new Date().toISOString().split('T')[0]}`); };
  const handleBulkDelete = async () => {
    const n = selectedFiles.length;
    if (!n) return;
    const ok = await confirm(`Supprimer ${n} document(s) sélectionné(s) ? Cette action est irréversible.`);
    if (!ok) return;
    await deleteFiles(selectedFiles);
    clearSelection();
  };

  // --- Export CSV de la liste de documents visible ---
  const exportCsv = (exportList: DossierFile[] = orgModalFiles, label: string = antenneName) => {
    const cell = (v: unknown) => {
      let s = String(v ?? '').replace(/[\r\n]+/g, ' ');
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ['Document', 'Organisme', 'Statut', 'Taille (Ko)', 'Date', 'Dépôt'];
    const rows = exportList.map((f) => [
      f.name,
      orgName(f.orgId),
      getStatusMeta(f.submissionStatus).label,
      Math.round(f.size / 1024),
      new Date(f.uploadDate).toLocaleString('fr-FR'),
      f.uploadedBy === 'admin' ? "Gestionnaire" : 'Partenaire',
    ]);
    const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `documents_${label}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Glisser-déposer de fichiers sur la zone documents.
  const onDropFiles = (e: any) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (dropped.length) handleUploadFiles(dropped as File[]);
  };

  // Couleur de la pastille de statut (lecture en un coup d'œil).
  const STATUS_SELECT_CLS: Record<SubmissionStatus, string> = {
    Pending: 'border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
    'Under review': 'border-azur/40 bg-azur/10 text-azur',
    Validated: 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Incomplete: 'border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
  };
  const statusSelectCls = (s?: SubmissionStatus) => STATUS_SELECT_CLS[s || 'Pending'] || STATUS_SELECT_CLS.Pending;

  // Ligne de document réutilisable (liste principale + fiche organisme).
  const renderFileRow = (file: DossierFile, opts?: { selectable?: boolean; tourExample?: boolean }) => {
   const fileNew = file.uploadedBy !== 'admin' && isUnseen(file.id, fileStamp(file));
   return (
    <div
      key={file.id}
      data-tour={opts?.tourExample ? 'org-doc' : undefined}
      onClickCapture={() => { if (fileNew) markSeen(file.id); }}
      className={`relative flex items-center gap-3 px-4 py-3 transition-colors ${selectedIds.has(file.id) ? 'bg-azur/5' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800'} ${fileNew ? 'ring-2 ring-inset ring-rose-400 dark:ring-rose-500/70 bg-rose-50/40 dark:bg-rose-500/5' : ''}`}
      title={fileNew ? 'Nouveau document — cliquez pour le marquer comme vu' : undefined}
    >
      {opts?.selectable && (
        <input
          type="checkbox"
          checked={selectedIds.has(file.id)}
          onChange={() => toggleSelect(file.id)}
          className="w-4 h-4 accent-azur cursor-pointer shrink-0"
          title="Sélectionner"
        />
      )}
      <div className="relative w-9 h-9 rounded-lg bg-azur/10 text-azur flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
        {fileNew && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setPreviewFile(file)}
            className="font-medium text-slate-800 dark:text-slate-100 hover:text-azur truncate block text-left min-w-0"
          >
            {file.name}
          </button>
          {fileNew && (
            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
              Nouveau
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {orgName(file.orgId)} · {formatBytes(file.size)} · {new Date(file.uploadDate).toLocaleDateString('fr-FR')}
        </p>
        {file.reviewNote && (
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-2 py-1 flex items-start gap-1.5">
            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="min-w-0">{file.reviewNote}</span>
          </p>
        )}
      </div>

      {/* Sélecteur de statut */}
      <div data-tour={opts?.tourExample ? 'org-doc-validate' : undefined} className="relative shrink-0">
        <select
          value={file.submissionStatus || 'Pending'}
          onChange={(e) => handleUpdateStatus(file, e.target.value as SubmissionStatus)}
          className={`appearance-none cursor-pointer text-xs font-bold rounded-full border pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-azur/30 ${statusSelectCls(file.submissionStatus)}`}
          title="Changer le statut du document"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{getStatusMeta(s).label}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 opacity-60 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Partage avec le partenaire (uniquement pour les dépôts gestionnaire) */}
      {file.uploadedBy === 'admin' && (
        <button
          onClick={() => handleToggleShare(file)}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 transition-colors ${
            file.sharedWithPartner !== false
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
          }`}
          title={file.sharedWithPartner !== false ? 'Partagé avec le partenaire (cliquer pour rendre privé)' : 'Privé (cliquer pour partager)'}
        >
          {file.sharedWithPartner !== false ? '🔓 Partagé' : '🔒 Privé'}
        </button>
      )}

      <button
        onClick={() => openNote(file)}
        className={`btn-ghost p-2 shrink-0 ${file.reviewNote ? 'text-amber-600 dark:text-amber-300' : ''}`}
        title={file.reviewNote ? 'Modifier la note de revue' : 'Ajouter une note (ce qu\'il faut corriger)'}
      >
        <MessageSquare className="w-4 h-4" />
      </button>
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
        className="btn-ghost p-2 shrink-0 text-rose-500 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10"
        title="Supprimer"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
   );
  };

  if (!organization) return null;

  const selectedOrg = selectedOrgId ? partnerOrgs.find((o) => o.id === selectedOrgId) || null : null;

  const STAT_CARDS = [
    { label: 'Documents', value: stats.total, icon: FileText, tone: 'text-azur bg-azur/10' },
    { label: 'Organismes', value: stats.organisms, icon: Building2, tone: 'text-deep dark:text-azur-pastel bg-azur-light dark:bg-azur/15' },
    { label: 'En attente', value: stats.pending, icon: Clock, tone: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'En révision', value: stats.review, icon: AlertCircle, tone: 'text-azur bg-azur/10' },
    { label: 'Validés', value: stats.validated, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10' },
  ];

  // Un coordinateur d'antenne sans antenne affectée ne peut rien gérer : on
  // l'informe clairement au lieu d'afficher un tableau de bord vide.
  if (!antenneId) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-800/40 text-slate-800 dark:text-slate-100 font-sans flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center">
          <MapPin className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="font-display text-xl font-bold text-deep dark:text-azur-pastel">Aucune antenne affectée</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
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
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-800/40 text-slate-800 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-azur-light dark:bg-azur/15 flex items-center justify-center shrink-0">
            <LogoASF className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base sm:text-lg font-bold text-deep dark:text-azur-pastel leading-tight truncate">
              Antenne {antenneName}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 text-azur" /> {delegationName} · Espace gestionnaire
            </p>
          </div>
          <button
            onClick={startTour}
            data-tour="tutoriel"
            className="btn-sourire text-sm"
            title="Visite guidée du tableau de bord"
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">Tutoriel</span>
          </button>
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
          {/* Cessna qui traverse la bannière */}
          <div className="asf-plane-cross-slow absolute top-3 left-0 w-20 opacity-60 pointer-events-none">
            <CessnaPlane variant="white" className="w-full" />
          </div>
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
        <div data-tour="kpi" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_CARDS.map((c) => (
            <div key={c.label} className="card-asf p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${c.tone}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="font-display text-2xl font-bold text-deep dark:text-azur-pastel">{c.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Dossiers soumis à traiter — notification proéminente */}
        {pendingSubmissions.length > 0 && (
          <section className="rounded-2xl border-l-4 border-azur bg-azur/5 dark:bg-azur/10 border border-azur/20 dark:border-azur/30 p-4 sm:p-5 shadow-asf-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-9 h-9 rounded-xl bg-azur text-white flex items-center justify-center shrink-0">
                <Send className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-deep dark:text-azur-pastel text-sm">
                  Dossiers soumis à traiter
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pendingSubmissions.length} organisme{pendingSubmissions.length > 1 ? 's ont' : ' a'} soumis son dossier pour revue.
                </p>
              </div>
              <span className="ml-auto text-xs font-black text-white bg-azur rounded-full px-2.5 py-1 font-mono shrink-0">
                {pendingSubmissions.length}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {pendingSubmissions.slice(0, 6).map(({ org, at }) => (
                <li key={org.id}>
                  <button
                    onClick={() => { setView('workspace'); openOrg(org.id); }}
                    className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border transition-colors group ${isUnseen(org.id, at) ? 'border-rose-300 dark:border-rose-500/60 ring-1 ring-rose-200 dark:ring-rose-500/30' : 'border-slate-200 dark:border-slate-700 hover:border-azur dark:hover:border-azur'}`}
                  >
                    <Send className="w-4 h-4 text-azur shrink-0" />
                    <span className="min-w-0 grow truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{org.name}</span>
                    {isUnseen(org.id, at) && (
                      <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">Nouveau</span>
                    )}
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono shrink-0 hidden sm:inline">
                      {new Date(at).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="text-[11px] font-bold text-azur shrink-0 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                      Traiter <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Navigation par onglets : évite une page trop longue */}
        <div data-tour="tabs" className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 rounded-2xl p-1.5 shadow-asf-sm w-full sm:w-fit overflow-x-auto">
          {([
            { id: 'workspace', label: 'Espace de travail', icon: Building2 },
            { id: 'activity', label: 'Journal', icon: Clock },
            { id: 'settings', label: 'Réglages', icon: Bell },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                view === t.id ? 'bg-azur text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Réglages : notification e-mail à chaque dépôt */}
        {view === 'settings' && (
        <section data-tour="settings-notify" className="card-asf p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-deep dark:text-azur-pastel font-bold tracking-tight">Notifications par e-mail</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Un e-mail à chaque nouveau dépôt d'un partenaire.
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
            <span className="text-sm font-semibold text-deep dark:text-azur-pastel">Activer les notifications de dépôt</span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold block mb-1">
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
              className="btn-asf text-sm whitespace-nowrap disabled:opacity-60"
            >
              {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </section>
        )}

        {view === 'workspace' && (<>
        {/* Organismes */}
        <section className="space-y-3">
          <h2 className="font-display text-deep dark:text-azur-pastel font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-azur" /> Organismes
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500">· cliquez pour gérer</span>
          </h2>

          {/* Recherche + filtres rapides par statut */}
          {partnerOrgs.length > 0 && (
            <div data-tour="filters" className="space-y-2.5">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={orgSearchRef}
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Rechercher un organisme…"
                  className="input-asf pl-9 pr-14 py-2 w-full text-sm"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800/50 hidden sm:block">⌘K</span>
              </div>
              <StatusFilterChips
                value={orgQuickStatus}
                onChange={setOrgQuickStatus}
                counts={orgStatusCounts}
                allLabel="Tous"
                className="gap-2"
                chipClass={(active) =>
                  `text-xs font-bold px-3 py-1.5 rounded-full border inline-flex items-center transition-colors ${active ? 'bg-azur text-white border-azur' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-azur/40'}`
                }
              />
            </div>
          )}

          {partnerOrgs.length === 0 ? (
            <div className="card-asf p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucun organisme rattaché à cette antenne pour le moment.
            </div>
          ) : filteredPartnerOrgs.length === 0 ? (
            <div className="card-asf p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucun organisme ne correspond à votre recherche.
            </div>
          ) : (
            <div data-tour="orgs" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPartnerOrgs.map((org) => {
                const orgFiles = files.filter((f) => f.orgId === org.id);
                const validated = orgFiles.filter((f) => (f.submissionStatus || 'Pending') === 'Validated').length;
                const orgSubmitTs = submittedMap[org.id] || org.dossierSubmittedAt || 0;
                const orgNew = isUnseen(org.id, orgSubmitTs);
                return (
                  <button
                    key={org.id}
                    onClick={() => openOrg(org.id)}
                    className={`card-asf p-4 text-left hover:border-azur hover:shadow-md transition-all cursor-pointer group relative ${orgNew ? 'ring-2 ring-rose-400 dark:ring-rose-500/70 bg-rose-50/40 dark:bg-rose-500/5' : ''}`}
                    title={orgNew ? 'Nouveau dossier soumis — cliquez pour le traiter' : 'Voir les documents et gérer ce compte'}
                  >
                    {orgNew && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-deep dark:text-azur-pastel truncate group-hover:text-azur transition-colors">{org.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{org.email}</p>
                      </div>
                      <StatusBadge status={org.submissionStatus} />
                    </div>
                    {orgSubmitTs > 0 && (
                      orgNew ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-extrabold uppercase tracking-wider text-white bg-rose-500 rounded-full px-2 py-0.5">
                          <Send className="w-3 h-3" /> Nouveau · dossier soumis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Dossier soumis
                        </span>
                      )
                    )}
                    <div className="mt-3">
                      <ComplianceBar validated={validated} total={orgFiles.length} />
                    </div>
                    <p className="text-xs mt-2.5 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{orgFiles.length} document{orgFiles.length > 1 ? 's' : ''}</span>
                      <span className="inline-flex items-center gap-1 text-azur font-bold group-hover:translate-x-0.5 transition-transform">
                        Gérer <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Documents internes de l'antenne (non rattachés à un organisme) */}
        <section className="space-y-3">
          <h2 className="font-display text-deep dark:text-azur-pastel font-bold tracking-tight flex items-center gap-2">
            <FolderIcon className="w-5 h-5 text-azur" /> Documents internes
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500">· de l'antenne</span>
          </h2>
          <button
            onClick={openInternal}
            data-tour="internal"
            className="card-asf p-4 text-left hover:border-azur hover:shadow-md transition-all cursor-pointer group w-full sm:max-w-sm"
            title="Documents de l'antenne non rattachés à un organisme"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-deep dark:text-azur-pastel group-hover:text-azur transition-colors">Documents internes</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{internalAll.length} document{internalAll.length > 1 ? 's' : ''} · usage interne</p>
              </div>
              <span className="inline-flex items-center gap-1 text-azur font-bold group-hover:translate-x-0.5 transition-transform">
                Ouvrir <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        </section>
        </>)}

        {/* Journal d'activité de l'antenne */}
        {view === 'activity' && (
        <section data-tour="journal">
          <AuditLogPanel
            antenneId={antenneId}
            title="Journal d'activité"
            subtitle={`Actions des comptes de l'antenne ${antenneName}.`}
          />
        </section>
        )}
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel">Renommer le document</h3>
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

      {/* Note de revue d'un fichier (ce qu'il faut corriger) */}
      {noteFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !savingNote && setNoteFile(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel">Note de revue</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{noteFile.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Indiquez à l'organisme ce qu'il doit corriger sur cette pièce. La note s'affiche dans son espace.
            </p>
            <textarea
              autoFocus
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              rows={4}
              className="input-asf w-full resize-none"
              placeholder="Ex. : document illisible, signature manquante, version périmée…"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteFile(null)} disabled={savingNote} className="btn-secondary text-sm">Annuler</button>
              <button onClick={saveNote} disabled={savingNote} className="btn-asf text-sm">
                {savingNote ? 'Enregistrement…' : 'Enregistrer la note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de suppression */}
      {deletingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !deleting && setDeletingFile(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-300 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel">Supprimer le document ?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 truncate">
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

      {/* Fiche détaillée d'un organisme : ses documents + gestion du compte */}
      {selectedOrg && (() => {
        const isValidated = (selectedOrg.submissionStatus || 'Pending') === 'Validated';
        const orgAll = files.filter((f) => f.orgId === selectedOrg.id);
        const orgValidated = orgAll.filter((f) => (f.submissionStatus || 'Pending') === 'Validated').length;
        return (
        <div
          className="fixed inset-0 z-40 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-overlay-in"
          onClick={closeOrg}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-asf-lg w-full max-w-6xl my-auto animate-panel-in overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-azur/5 to-transparent">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-xl font-bold text-deep dark:text-azur-pastel truncate">{selectedOrg.name}</h3>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${isValidated ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isValidated ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {isValidated ? 'Compte validé' : 'Accès suspendu'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {orgAll.length} document{orgAll.length > 1 ? 's' : ''} · {orgValidated} validé{orgValidated > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setActiveTour(orgModalTour)}
                  className="btn-ghost p-2"
                  title="Comment utiliser cette fiche ?"
                >
                  <GraduationCap className="w-5 h-5" />
                </button>
                <button
                  onClick={() => openReminder(selectedOrg)}
                  disabled={!selectedOrg.email}
                  className="btn-secondary text-sm disabled:opacity-50"
                  title={selectedOrg.email ? 'Rédiger et envoyer une relance par e-mail' : 'Aucune adresse e-mail'}
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Relancer</span>
                </button>
                <button onClick={closeOrg} className="btn-ghost p-2" title="Fermer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Corps : fiche du compte (gauche) + documents (droite) */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

              {/* Rail gauche : coordonnées, dates, conformité, accès */}
              <aside className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 overflow-y-auto">
                <div className="p-5 space-y-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-2">Coordonnées</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2 text-slate-700 dark:text-slate-200"><User className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" /><span className="min-w-0 truncate">{selectedOrg.contactName || '—'}</span></li>
                      <li data-tour="org-email" className="flex items-start gap-2 text-slate-700 dark:text-slate-200"><Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" /><span className="min-w-0 break-all">{selectedOrg.email || '—'}</span></li>
                      <li className="flex items-start gap-2 text-slate-700 dark:text-slate-200"><Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" /><span className="min-w-0 truncate">{selectedOrg.phone || '—'}</span></li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Créé le</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedOrg.createdAt ? new Date(selectedOrg.createdAt).toLocaleDateString('fr-FR') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Activité</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedOrg.updatedAt ? new Date(selectedOrg.updatedAt).toLocaleDateString('fr-FR') : '—'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-2">Conformité des documents</p>
                    <ComplianceBar validated={orgValidated} total={orgAll.length} />
                  </div>

                  {(selectedOrg.dossierSubmittedAt || submittedMap[selectedOrg.id]) && (
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Dossier soumis pour revue</p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Le {new Date((selectedOrg.dossierSubmittedAt || submittedMap[selectedOrg.id])!).toLocaleDateString('fr-FR')} par l'organisme.</p>
                      </div>
                    </div>
                  )}

                  <div data-tour="org-access" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Accès de l'organisme</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {isValidated
                        ? "Validé : l'organisme peut se connecter et déposer ses documents."
                        : "Suspendu : aucun dépôt possible tant qu'il n'est pas validé."}
                    </p>
                    {isValidated ? (
                      <button
                        onClick={() => handleSetOrgValidated(selectedOrg, false)}
                        disabled={updatingOrgStatus}
                        className="mt-3 w-full text-sm font-bold px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <AlertCircle className="w-4 h-4" /> Suspendre le compte
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetOrgValidated(selectedOrg, true)}
                        disabled={updatingOrgStatus}
                        className="mt-3 w-full text-sm font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Valider le compte
                      </button>
                    )}
                  </div>
                </div>
              </aside>

              {/* Colonne droite : documents de l'organisme */}
              <section className="flex-1 min-w-0 flex flex-col min-h-0">

            {/* Répertoires associés (cartes) + navigation, façon Cabinet Documentaire */}
            <div data-tour="org-folders" className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              {orgFolderId ? (
                /* Vue d'un dossier : fil d'Ariane + actions du dossier */
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setOrgFolderId(null)}
                      className="btn-ghost text-xs !py-1.5 !px-3 inline-flex items-center gap-1.5"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Tous
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    <span className="text-sm font-bold text-deep dark:text-azur-pastel inline-flex items-center gap-1.5 min-w-0">
                      <FolderOpen className="w-4 h-4 shrink-0" />
                      <span className="truncate">{orgFolders.find((f) => f.id === orgFolderId)?.name}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => { const fol = orgFolders.find((f) => f.id === orgFolderId); if (fol) handleDeleteFolder(fol); }}
                    className="btn-ghost text-xs !py-1.5 !px-3 text-rose-500 dark:text-rose-300 inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer le dossier
                  </button>
                </div>
              ) : (
                /* Racine : section « Répertoires associés » en cartes */
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h4 className="text-xs font-display font-black uppercase tracking-wider text-deep dark:text-slate-300 flex items-center gap-1.5">
                        <FolderIcon className="w-3.5 h-3.5 text-azur" /> Répertoires associés et justificatifs réglementaires
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Dossiers de rangement privés à cet organisme (récépissés, assurances, brevets…).
                      </p>
                    </div>
                    <button
                      onClick={() => { setFolderName(''); setFolderTargetOrgId(selectedOrg.id); setCreatingFolder(true); }}
                      className="btn-asf text-xs shrink-0"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> Nouveau dossier
                    </button>
                  </div>
                  {orgFolders.length === 0 ? (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                      Aucun dossier — les pièces ci-dessous sont versées à la racine.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {orgFolders.map((fol) => {
                        const folderSelfNew = fol.createdBy !== 'admin' && isUnseen(fol.id, fol.createdAt || 0);
                        const folderHasNew = files.some((f) => (f.folderId || null) === fol.id && f.uploadedBy !== 'admin' && isUnseen(f.id, fileStamp(f)));
                        const folNew = folderSelfNew || folderHasNew;
                        return (
                        <div
                          key={fol.id}
                          onClick={() => { if (folderSelfNew) markSeen(fol.id); setOrgFolderId(fol.id); }}
                          className={`card-asf p-3.5 flex flex-col gap-2.5 group relative cursor-pointer ${folNew ? 'ring-2 ring-rose-400 dark:ring-rose-500/70 bg-rose-50/40 dark:bg-rose-500/5' : ''}`}
                          title={folNew ? 'Nouveau dossier — cliquez pour le marquer comme vu' : undefined}
                        >
                          {folNew && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />}
                          <div className="flex items-start justify-between gap-2">
                            <div className="w-9 h-9 rounded-xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                              <FolderIcon className="w-4 h-4 fill-current" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              {folNew && (
                                <span className="text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-rose-500 text-white">Nouveau</span>
                              )}
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                {fol.createdBy === 'admin' ? 'Admin' : 'Org'}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(fol); }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-all p-1 cursor-pointer"
                                title="Supprimer le dossier"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">{fol.name}</p>
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                              {folderFileCount(fol.id)} fichier(s) justificatifs
                            </p>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recherche, filtres et actions sur les documents de l'organisme */}
            <div data-tour="org-tools" className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={orgDocSearch}
                    onChange={(e) => setOrgDocSearch(e.target.value)}
                    placeholder="Rechercher dans ses documents…"
                    className="input-asf pl-9 py-2 w-full text-sm"
                  />
                </div>
                <select
                  value={orgStatusFilter}
                  onChange={(e) => setOrgStatusFilter(e.target.value as 'all' | SubmissionStatus)}
                  className="input-asf w-auto py-2 text-sm"
                  title="Filtrer par statut"
                >
                  <option value="all">Tous les statuts</option>
                  {STATUS_ORDER.map((s) => (<option key={s} value={s}>{getStatusMeta(s).label}</option>))}
                </select>
                <select
                  value={orgSortBy}
                  onChange={(e) => setOrgSortBy(e.target.value as any)}
                  className="input-asf w-auto py-2 text-sm"
                  title="Trier"
                >
                  <option value="date_desc">Plus récents</option>
                  <option value="date_asc">Plus anciens</option>
                  <option value="name">Nom (A→Z)</option>
                  <option value="status">Statut</option>
                  <option value="size">Taille</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={orgUploadRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const fs = e.target.files ? Array.from(e.target.files) : [];
                    if (fs.length) handleUploadFiles(fs as File[], selectedOrg.id, orgFolderId);
                    if (e.target) (e.target as any).value = '';
                  }}
                />
                <button
                  onClick={() => orgUploadRef.current && orgUploadRef.current.click()}
                  disabled={uploading}
                  className="btn-asf text-sm shrink-0 disabled:opacity-60"
                  title="Déposer un document pour cet organisme"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? `Envoi… ${uploadProgress}%` : 'Déposer'}</span>
                </button>
                <button
                  onClick={() => applyStatusToFiles(orgModalFiles, 'Validated')}
                  disabled={orgModalFiles.length === 0}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Tout valider
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => exportCsv(orgModalFiles, selectedOrg.name)}
                  disabled={orgModalFiles.length === 0}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-azur/40 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
                  title="Exporter la liste en CSV"
                >
                  <FileDown className="w-3.5 h-3.5" /> Export
                </button>
                <button
                  onClick={() => downloadAsZip(orgModalFiles, `${selectedOrg.name}_documents`)}
                  disabled={orgModalFiles.length === 0 || zipping}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-azur/40 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5" /> {zipping ? 'Archivage…' : '.zip'}
                </button>
              </div>
            </div>

            {/* Barre d'actions groupées (sélection multiple) */}
            {selectedIds.size > 0 && (
              <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 bg-azur/10 border-b border-azur/25">
                <span className="text-sm font-bold text-deep dark:text-azur-pastel">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                <div className="flex-1" />
                <button onClick={() => handleBulkStatus('Validated')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" /> Valider
                </button>
                <select
                  onChange={(e) => { if (e.target.value) { handleBulkStatus(e.target.value as SubmissionStatus); e.target.value = ''; } }}
                  defaultValue=""
                  className="input-asf w-auto text-xs py-1.5"
                  title="Changer le statut"
                >
                  <option value="" disabled>Statut…</option>
                  {STATUS_ORDER.map((s) => (<option key={s} value={s}>{getStatusMeta(s).label}</option>))}
                </select>
                <button onClick={handleBulkDownload} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-azur/40 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Télécharger
                </button>
                <button onClick={handleBulkDelete} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 inline-flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
                <button onClick={clearSelection} className="text-xs font-bold px-3 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Annuler</button>
              </div>
            )}

            {/* Documents de l'organisme */}
            <div data-tour="org-list" className="flex-1 min-h-[30vh] overflow-y-auto">
              <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                {orgModalFiles.length > 0 && (
                  <input
                    type="checkbox"
                    checked={orgModalFiles.every((f) => selectedIds.has(f.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(orgModalFiles.map((f) => f.id)));
                      else clearSelection();
                    }}
                    className="w-4 h-4 accent-azur cursor-pointer"
                    title="Tout sélectionner"
                  />
                )}
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {orgFolderId
                    ? `Dossier · ${orgFolders.find((f) => f.id === orgFolderId)?.name || ''}`
                    : 'Pièces versées à la racine (hors dossiers)'}
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  {orgModalFiles.length} document{orgModalFiles.length > 1 ? 's' : ''}
                </span>
                {(['Validated', 'Pending', 'Under review', 'Incomplete'] as SubmissionStatus[]).map((s) => {
                  const n = orgModalFiles.filter((f) => (f.submissionStatus || 'Pending') === s).length;
                  if (!n) return null;
                  return (
                    <span key={s} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusSelectCls(s)}`}>
                      {n} {getStatusMeta(s).label}
                    </span>
                  );
                })}
              </div>
              {orgModalFiles.length === 0 ? (
                <div className="px-5 pb-8 pt-2 text-center text-sm text-slate-400 dark:text-slate-500 font-semibold">
                  {orgDocSearch || orgStatusFilter !== 'all'
                    ? 'Aucun document ne correspond à votre recherche.'
                    : orgFolderId
                      ? 'Ce dossier est vide.'
                      : orgFolders.length > 0
                        ? 'Aucune pièce à la racine — les documents sont rangés dans les dossiers ci-dessus.'
                        : "Cet organisme n'a déposé aucun document pour le moment."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orgModalFiles.map((file, i) => renderFileRow(file, { selectable: true, tourExample: i === 0 }))}
                </div>
              )}
            </div>
              </section>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Gestionnaire des documents internes de l'antenne */}
      {internalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-overlay-in"
          onClick={closeInternal}
        >
          <div
            className={`bg-white dark:bg-slate-900 rounded-2xl shadow-asf-lg w-full max-w-5xl my-auto animate-panel-in ${dragOver ? 'ring-2 ring-azur' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDropFiles}
          >
            {/* En-tête */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel">Documents internes</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Documents de l'antenne non rattachés à un organisme.</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setActiveTour(internalModalTour)} className="btn-ghost p-2" title="Comment ça marche ?">
                  <GraduationCap className="w-5 h-5" />
                </button>
                <button onClick={closeInternal} className="btn-ghost p-2" title="Fermer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dossiers internes */}
            <div data-tour="int-folders" className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1.5 mb-2">
                <FolderIcon className="w-3.5 h-3.5" /> Dossiers internes
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveFolderId(null)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                    activeFolderId === null ? 'bg-azur text-white border-azur' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-azur/40'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Tous ({internalAll.length})
                </button>
                {internalFolders.map((fol) => (
                  <span
                    key={fol.id}
                    className={`text-xs font-bold pl-3 pr-1.5 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                      activeFolderId === fol.id ? 'bg-azur text-white border-azur' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-azur/40'
                    }`}
                  >
                    <button onClick={() => setActiveFolderId(fol.id)} className="inline-flex items-center gap-1.5 cursor-pointer">
                      {activeFolderId === fol.id ? <FolderOpen className="w-3.5 h-3.5" /> : <FolderIcon className="w-3.5 h-3.5" />}
                      {fol.name} ({folderFileCount(fol.id)})
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(fol)}
                      title="Supprimer le dossier"
                      className={`w-5 h-5 rounded-full inline-flex items-center justify-center transition-colors ${
                        activeFolderId === fol.id ? 'hover:bg-white/20' : 'hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 dark:text-slate-500 hover:text-rose-500'
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => { setFolderName(''); setFolderTargetOrgId(null); setCreatingFolder(true); }}
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-dashed border-azur/40 text-azur hover:bg-azur/5 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Nouveau dossier
                </button>
              </div>
            </div>

            {/* Barre d'actions */}
            <div data-tour="int-tools" className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className="input-asf pl-9 py-2 w-full text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SubmissionStatus)}
                className="input-asf w-auto py-2 text-sm"
                title="Filtrer par statut"
              >
                <option value="all">Tous les statuts</option>
                {STATUS_ORDER.map((s) => (<option key={s} value={s}>{getStatusMeta(s).label}</option>))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input-asf w-auto py-2 text-sm"
                title="Trier"
              >
                <option value="date_desc">Plus récents</option>
                <option value="date_asc">Plus anciens</option>
                <option value="name">Nom (A→Z)</option>
                <option value="status">Statut</option>
                <option value="size">Taille</option>
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
                title="Déposer un document interne"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? `Envoi… ${uploadProgress}%` : 'Déposer'}</span>
              </button>
              <button
                onClick={() => applyStatusToFiles(internalFiles, 'Validated')}
                disabled={internalFiles.length === 0}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tout valider
              </button>
              <button
                onClick={() => exportCsv(internalFiles, 'internes')}
                disabled={internalFiles.length === 0}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-azur/40 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
                title="Exporter la liste en CSV"
              >
                <FileDown className="w-3.5 h-3.5" /> Export
              </button>
              <button
                onClick={() => downloadAsZip(internalFiles, 'documents_internes')}
                disabled={internalFiles.length === 0 || zipping}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-azur/40 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" /> {zipping ? 'Archivage…' : '.zip'}
              </button>
            </div>

            {/* Barre d'actions groupées */}
            {selectedIds.size > 0 && (
              <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 bg-azur/10 border-b border-azur/25">
                <span className="text-sm font-bold text-deep dark:text-azur-pastel">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                <div className="flex-1" />
                <button onClick={() => handleBulkStatus('Validated')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" /> Valider
                </button>
                <button onClick={handleBulkDownload} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-azur/40 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Télécharger
                </button>
                <button onClick={handleBulkDelete} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 inline-flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
                <button onClick={clearSelection} className="text-xs font-bold px-3 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Annuler</button>
              </div>
            )}

            {/* Liste */}
            <div data-tour="int-list" className="max-h-[50vh] overflow-y-auto">
              <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800">
                {internalFiles.length > 0 && (
                  <input
                    type="checkbox"
                    checked={internalFiles.every((f) => selectedIds.has(f.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(internalFiles.map((f) => f.id)));
                      else clearSelection();
                    }}
                    className="w-4 h-4 accent-azur cursor-pointer"
                    title="Tout sélectionner"
                  />
                )}
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {internalFiles.length} document{internalFiles.length > 1 ? 's' : ''}
                </span>
                {dragOver && <span className="text-[11px] font-bold text-azur ml-auto">Déposez pour téléverser…</span>}
              </div>
              {internalFiles.length === 0 ? (
                <div className="px-5 pb-8 pt-4 text-center text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                  <CloudUpload className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  Aucun document interne.
                  <span className="text-xs">Glissez-déposez des fichiers ici ou utilisez « Déposer ».</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {internalFiles.map((file) => renderFileRow(file, { selectable: true }))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale de création de dossier */}
      {creatingFolder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-overlay-in" onClick={() => { setCreatingFolder(false); setFolderTargetOrgId(null); }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-asf-lg w-full max-w-md p-6 space-y-4 animate-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel">Nouveau dossier</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {folderTargetOrgId
                    ? <>Privé à <strong>{orgName(folderTargetOrgId)}</strong> — visible par cet organisme uniquement.</>
                    : "Pour organiser les documents internes de l'antenne."}
                </p>
              </div>
            </div>
            <input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
              className="input-asf w-full"
              placeholder="Nom du dossier (ex. Masse & centrage)"
              maxLength={200}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCreatingFolder(false); setFolderTargetOrgId(null); }} className="btn-secondary text-sm">Annuler</button>
              <button onClick={handleCreateFolder} disabled={!folderName.trim()} className="btn-asf text-sm disabled:opacity-60">Créer le dossier</button>
            </div>
          </div>
        </div>
      )}

      {/* Éditeur de relance : modifier le texte avant l'envoi */}
      {reminderOrg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-overlay-in" onClick={() => !reminding && setReminderOrg(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-asf-lg w-full max-w-lg p-6 space-y-4 animate-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-deep dark:text-azur-pastel">Relancer {reminderOrg.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">À : {reminderOrg.email}</p>
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold block mb-1">Objet</label>
              <input
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
                className="input-asf w-full text-sm"
                placeholder="Objet de l'e-mail"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold block mb-1">Message</label>
              <textarea
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
                rows={10}
                className="input-asf w-full text-sm leading-relaxed resize-y"
                placeholder="Texte du message…"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Vous pouvez modifier librement le texte avant l'envoi.</p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setReminderOrg(null)} disabled={reminding} className="btn-secondary text-sm disabled:opacity-60">Annuler</button>
              <button onClick={sendReminder} disabled={reminding || !reminderBody.trim()} className="btn-asf text-sm disabled:opacity-60">
                <Send className="w-4 h-4" />
                {reminding ? 'Envoi…' : 'Envoyer la relance'}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <GuidedTour open={!!activeTour} steps={activeTour || []} onClose={() => setActiveTour(null)} />
    </div>
  );
}
