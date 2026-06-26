export type SubmissionStatus = 'Pending' | 'Under review' | 'Validated' | 'Incomplete';

export interface Organization {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  submissionStatus: SubmissionStatus;
  role: 'super_admin' | 'admin' | 'admin_delegation' | 'admin_antenne' | 'organization';
  delegation_id?: string;
  antenne_id?: string;
  createdAt: number;
  updatedAt: number;
  /** Vrai une fois la visite guidée affichée automatiquement (1ʳᵉ connexion). */
  hasSeenTour?: boolean;
  /** Date à laquelle l'organisme a soumis son dossier complet pour revue. */
  dossierSubmittedAt?: number;
}

export interface DossierFile {
  id: string;
  orgId: string;
  folderId?: string | null;
  name: string;
  size: number;
  type: string;
  storagePath: string;
  fallbackDataUrl?: string | null;
  uploadDate: number;
  uploadedBy?: 'admin' | 'user';
  delegation_id?: string;
  antenne_id?: string;
  submissionStatus?: SubmissionStatus;
  sharedWithPartner?: boolean;
  /** Note de revue rédigée par l'antenne : ce que l'organisme doit corriger. */
  reviewNote?: string;
  /** Dernière modification par l'organisme (renommage…). Sert au repérage
   *  « Nouveau » côté antenne. */
  updatedAt?: number;
  /** Date (timestamp ms) de suppression automatique programmée par le
   *  gestionnaire d'antenne. `null`/absent = pas de suppression programmée. */
  expiresAt?: number | null;
}

export interface Folder {
  id: string;
  orgId: string;
  name: string;
  createdAt: number;
  createdBy?: 'admin' | 'user';
  delegation_id?: string;
  antenne_id?: string;
  /** Date (timestamp ms) de suppression automatique programmée par le
   *  gestionnaire d'antenne : à échéance, le dossier ET les fichiers qu'il
   *  contient sont supprimés. `null`/absent = pas de suppression programmée. */
  expiresAt?: number | null;
}

// Invitation/attribution d'un gestionnaire d'antenne par e-mail. Créée par le
// super admin ; appliquée automatiquement à la connexion du compte
// correspondant (le compte est alors promu rôle `admin_antenne`).
export interface AntenneInvite {
  id: string;          // = e-mail en minuscules (clé du document)
  email: string;       // e-mail en minuscules
  delegation_id: string;
  antenne_id: string;
  createdAt: number;
}

// Groupe thématique d'antennes (relation many-to-many : une antenne peut
// appartenir à plusieurs groupes, ou à aucun). Géré par le super admin.
export interface AntenneGroup {
  id: string;
  name: string;
  color?: string;
  antenneIds: string[];
  createdAt: number;
  updatedAt: number;
}
