import { AntenneGroup, DossierFile, Folder, Organization, SubmissionStatus } from '../types';

// Let's create an excellent Local Storage backup & fallback database for when Firestore Quota is exceeded
const STORAGE_KEYS = {
  ORGS: 'asf_local_orgs',
  FILES: 'asf_local_files',
  FOLDERS: 'asf_local_folders',
  ANTENNES: 'asf_local_antennes',
  DELEGATIONS: 'asf_local_delegations',
  ANTENNE_GROUPS: 'asf_local_antenne_groups',
  SANDBOX_MODE: 'asf_quota_exceeded'
};

const DEFAULT_DELEGATIONS_DATA = [
  { id: 'france', name: 'Aviation Sans Frontières France' }
];

const DEFAULT_ANTENNES_DATA: Record<string, { id: string; name: string; x?: number; y?: number }[]> = {
  'france': [
    { id: 'nantes', name: 'Nantes', x: 26, y: 28 },
    { id: 'paris', name: 'Paris - Île de France', x: 49, y: 15 },
    { id: 'toulouse', name: 'Toulouse', x: 42, y: 72 },
    { id: 'marseille', name: 'Marseille', x: 69, y: 74 },
    { id: 'lyon', name: 'Lyon', x: 63, y: 44 },
    { id: 'bordeaux', name: 'Bordeaux', x: 29, y: 55 },
    { id: 'lille', name: 'Lille', x: 54, y: 3 },
    { id: 'strasbourg', name: 'Strasbourg', x: 86, y: 16 },
  ],
};

const INITIAL_MOCK_ORGS: Organization[] = [
  {
    id: 'org_nantes_1',
    name: "Association Handicap & Sourires Loire",
    contactName: "Jean Dupont",
    email: "direction@handicapsourire44.org",
    phone: "02 40 12 34 56",
    submissionStatus: 'Validated',
    role: 'organization',
    delegation_id: 'france',
    antenne_id: 'nantes',
    createdAt: Date.now() - 30 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 25 * 24 * 3600 * 1000
  },
  {
    id: 'org_nantes_2',
    name: "Institut Thérapeutique de l'Erdre (ITE)",
    contactName: "Claire Martin",
    email: "contact@ite-nantes.fr",
    phone: "02 40 98 76 54",
    submissionStatus: 'Pending',
    role: 'organization',
    delegation_id: 'france',
    antenne_id: 'nantes',
    createdAt: Date.now() - 5 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 5 * 24 * 3600 * 1000
  },
  {
    id: 'org_toulouse_1',
    name: "Ailes Occitanes Solidaires",
    contactName: "Paul Gauthier",
    email: "social@ailes-occitanes.org",
    phone: "05 61 22 33 44",
    submissionStatus: 'Under review',
    role: 'organization',
    delegation_id: 'france',
    antenne_id: 'toulouse',
    createdAt: Date.now() - 12 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 1 * 24 * 3600 * 1000
  },
  {
    id: 'org_paris_1',
    name: "Foyers de l'Enfance Paris Nord",
    contactName: "Amélie Bernard",
    email: "foyer@parisnord-enfants.org",
    phone: "01 44 55 66 77",
    submissionStatus: 'Incomplete',
    role: 'organization',
    delegation_id: 'france',
    antenne_id: 'paris',
    createdAt: Date.now() - 15 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 2 * 24 * 3600 * 1000
  }
];

const INITIAL_MOCK_FOLDERS: Folder[] = [
  {
    id: 'folder_nantes_1',
    orgId: 'org_nantes_1',
    name: "Session de Vol Printemps 2026",
    createdAt: Date.now() - 25 * 24 * 3600 * 1000,
    delegation_id: 'france',
    antenne_id: 'nantes'
  },
  {
    id: 'folder_nantes_2',
    orgId: 'org_nantes_2',
    name: "Dossier Médical & Certificats de Vol",
    createdAt: Date.now() - 5 * 24 * 3600 * 1000,
    delegation_id: 'france',
    antenne_id: 'nantes'
  },
  {
    id: 'folder_toulouse_1',
    orgId: 'org_toulouse_1',
    name: "Autorisation Annuelle 2026",
    createdAt: Date.now() - 12 * 24 * 3600 * 1000,
    delegation_id: 'france',
    antenne_id: 'toulouse'
  }
];

const INITIAL_MOCK_FILES: DossierFile[] = [
  {
    id: 'file_nantes_1_1',
    orgId: 'org_nantes_1',
    folderId: 'folder_nantes_1',
    name: "mode_demployment_ailes_du_sourire.png",
    size: 198300,
    type: "image/png",
    storagePath: "delegations/france/nantes/mock1.png",
    fallbackDataUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=400",
    uploadDate: Date.now() - 25 * 24 * 3600 * 1000,
    uploadedBy: 'admin',
    delegation_id: 'france',
    antenne_id: 'nantes',
    submissionStatus: 'Validated'
  },
  {
    id: 'file_nantes_1_2',
    orgId: 'org_nantes_1',
    folderId: 'folder_nantes_1',
    name: "attestation_responsabilite_civile.pdf",
    size: 1042000,
    type: "application/pdf",
    storagePath: "delegations/france/nantes/mock2.pdf",
    fallbackDataUrl: "#",
    uploadDate: Date.now() - 24 * 24 * 3600 * 1000,
    uploadedBy: 'user',
    delegation_id: 'france',
    antenne_id: 'nantes',
    submissionStatus: 'Validated'
  },
  {
    id: 'file_nantes_2_1',
    orgId: 'org_nantes_2',
    folderId: 'folder_nantes_2',
    name: "licences_pilotes_benevoles.pdf",
    size: 2045000,
    type: "application/pdf",
    storagePath: "delegations/france/nantes/mock3.pdf",
    fallbackDataUrl: "#",
    uploadDate: Date.now() - 5 * 24 * 3600 * 1000,
    uploadedBy: 'user',
    delegation_id: 'france',
    antenne_id: 'nantes',
    submissionStatus: 'Pending'
  },
  {
    id: 'file_toulouse_1_1',
    orgId: 'org_toulouse_1',
    folderId: 'folder_toulouse_1',
    name: "protocole_medical_de_secourisme.pdf",
    size: 450000,
    type: "application/pdf",
    storagePath: "delegations/france/toulouse/mock4.pdf",
    fallbackDataUrl: "#",
    uploadDate: Date.now() - 10 * 24 * 3600 * 1000,
    uploadedBy: 'user',
    delegation_id: 'france',
    antenne_id: 'toulouse',
    submissionStatus: 'Under review'
  },
  {
    id: 'file_toulouse_1_2',
    orgId: 'org_toulouse_1',
    folderId: 'folder_toulouse_1',
    name: "liste_des_participants_autorises.pdf",
    size: 120000,
    type: "application/pdf",
    storagePath: "delegations/france/toulouse/mock5.pdf",
    fallbackDataUrl: "#",
    uploadDate: Date.now() - 11 * 24 * 3600 * 1000,
    uploadedBy: 'user',
    delegation_id: 'france',
    antenne_id: 'toulouse',
    submissionStatus: 'Validated'
  }
];

// Le mode "sandbox" (repli local) est désormais conservé EN MÉMOIRE seulement,
// et non plus dans localStorage. Conséquence : chaque rechargement de page
// repart en mode "Firebase réel" et ne reste donc jamais bloqué en sandbox.
// Si Firebase échoue à nouveau, l'app y rebascule automatiquement pour la
// session courante. Les données locales de secours restent, elles, dans
// localStorage (orgs/fichiers/dossiers).
let sandboxActiveMemory = false;

export const localDb = {
  isSandboxActive(): boolean {
    return sandboxActiveMemory;
  },

  setSandboxActive(active: boolean) {
    sandboxActiveMemory = active;
    // Nettoyage d'un éventuel ancien drapeau persistant (migration).
    if (localStorage.getItem(STORAGE_KEYS.SANDBOX_MODE)) {
      localStorage.removeItem(STORAGE_KEYS.SANDBOX_MODE);
    }
  },

  init() {
    // Pre-populate mock database if storage keys don't exist
    if (!localStorage.getItem(STORAGE_KEYS.ORGS)) {
      localStorage.setItem(STORAGE_KEYS.ORGS, JSON.stringify(INITIAL_MOCK_ORGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.FOLDERS)) {
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(INITIAL_MOCK_FOLDERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.FILES)) {
      localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(INITIAL_MOCK_FILES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DELEGATIONS)) {
      localStorage.setItem(STORAGE_KEYS.DELEGATIONS, JSON.stringify(DEFAULT_DELEGATIONS_DATA));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ANTENNES)) {
      localStorage.setItem(STORAGE_KEYS.ANTENNES, JSON.stringify(DEFAULT_ANTENNES_DATA));
    }
  },

  // GETTERS
  getOrganizations(): Organization[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ORGS) || '[]');
    } catch {
      return INITIAL_MOCK_ORGS;
    }
  },

  getFiles(): DossierFile[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.FILES) || '[]');
    } catch {
      return INITIAL_MOCK_FILES;
    }
  },

  getFolders(): Folder[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.FOLDERS) || '[]');
    } catch {
      return INITIAL_MOCK_FOLDERS;
    }
  },

  getDelegations() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.DELEGATIONS) || '[]');
    } catch {
      return DEFAULT_DELEGATIONS_DATA;
    }
  },

  getAntennes(): Record<string, { id: string; name: string; x?: number; y?: number }[]> {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ANTENNES) || '{}');
    } catch {
      return DEFAULT_ANTENNES_DATA;
    }
  },

  getGroups(): AntenneGroup[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ANTENNE_GROUPS) || '[]');
    } catch {
      return [];
    }
  },

  // METHODS FOR WRITING / MUTATIONS
  triggerUpdate() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('localdb-update'));
    }
  },

  saveOrganization(org: Organization) {
    const list = this.getOrganizations();
    const index = list.findIndex(o => o.id === org.id);
    if (index !== -1) {
      list[index] = org;
    } else {
      list.push(org);
    }
    localStorage.setItem(STORAGE_KEYS.ORGS, JSON.stringify(list));
    this.triggerUpdate();
  },

  deleteOrganization(orgId: string) {
    const list = this.getOrganizations().filter(o => o.id !== orgId);
    localStorage.setItem(STORAGE_KEYS.ORGS, JSON.stringify(list));
    this.triggerUpdate();
  },

  saveFile(file: DossierFile) {
    const list = this.getFiles();
    const index = list.findIndex(f => f.id === file.id);
    if (index !== -1) {
      list[index] = file;
    } else {
      list.push(file);
    }
    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(list));
    this.triggerUpdate();
  },

  saveFolder(folder: Folder) {
    const list = this.getFolders();
    const index = list.findIndex(fd => fd.id === folder.id);
    if (index !== -1) {
      list[index] = folder;
    } else {
      list.push(folder);
    }
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(list));
    this.triggerUpdate();
  },

  deleteFile(fileId: string) {
    const list = this.getFiles();
    const filtered = list.filter(f => f.id !== fileId);
    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(filtered));
    this.triggerUpdate();
  },

  deleteFolder(folderId: string) {
    const list = this.getFolders();
    const filtered = list.filter(fd => fd.id !== folderId);
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(filtered));

    // Also delete associated files
    const files = this.getFiles();
    const remainingFiles = files.filter(f => f.folderId !== folderId);
    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(remainingFiles));
    this.triggerUpdate();
  },

  addAntenne(delegationId: string, name: string, x?: number, y?: number) {
    const current = this.getAntennes();
    if (!current[delegationId]) {
      current[delegationId] = [];
    }
    const newId = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
    const newItem = { id: newId, name, x, y };
    if (!current[delegationId].some(a => a.id === newId)) {
      current[delegationId].push(newItem);
    }
    localStorage.setItem(STORAGE_KEYS.ANTENNES, JSON.stringify(current));
    this.triggerUpdate();
    return newItem;
  },

  saveGroup(group: AntenneGroup) {
    const list = this.getGroups();
    const index = list.findIndex(g => g.id === group.id);
    if (index !== -1) {
      list[index] = group;
    } else {
      list.push(group);
    }
    localStorage.setItem(STORAGE_KEYS.ANTENNE_GROUPS, JSON.stringify(list));
    this.triggerUpdate();
  },

  deleteGroup(groupId: string) {
    const list = this.getGroups();
    const filtered = list.filter(g => g.id !== groupId);
    localStorage.setItem(STORAGE_KEYS.ANTENNE_GROUPS, JSON.stringify(filtered));
    this.triggerUpdate();
  },

  // Retire un id d'antenne de tous les groupes (nettoyage à la suppression d'une antenne).
  removeAntenneFromAllGroups(antenneId: string) {
    const list = this.getGroups();
    let changed = false;
    const updated = list.map(g => {
      if (g.antenneIds.includes(antenneId)) {
        changed = true;
        return { ...g, antenneIds: g.antenneIds.filter(id => id !== antenneId), updatedAt: Date.now() };
      }
      return g;
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.ANTENNE_GROUPS, JSON.stringify(updated));
      this.triggerUpdate();
    }
  },

  updateAntenneCoordinates(delegationId: string, antenneId: string, x: number, y: number) {
    const current = this.getAntennes();
    if (current[delegationId]) {
      const found = current[delegationId].find(a => a.id === antenneId);
      if (found) {
        found.x = x;
        found.y = y;
        localStorage.setItem(STORAGE_KEYS.ANTENNES, JSON.stringify(current));
        this.triggerUpdate();
      }
    }
  }
};
