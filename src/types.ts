export type SubmissionStatus = 'Pending' | 'Under review' | 'Validated' | 'Incomplete';

export interface Organization {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  submissionStatus: SubmissionStatus;
  role: 'super_admin' | 'admin' | 'admin_delegation' | 'organization';
  delegation_id?: string;
  antenne_id?: string;
  createdAt: number;
  updatedAt: number;
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
}

export interface Folder {
  id: string;
  orgId: string;
  name: string;
  createdAt: number;
  createdBy?: 'admin' | 'user';
  delegation_id?: string;
  antenne_id?: string;
}
