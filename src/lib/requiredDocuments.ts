/**
 * Checklist des pièces réglementaires attendues d'un organisme partenaire.
 *
 * Source unique de vérité de la liste des documents obligatoires. Chaque pièce
 * est rattachée à un document de deux façons :
 *  - explicitement, via le champ `category` du document (choisi par l'organisme
 *    ou un coordinateur) ;
 *  - automatiquement, par correspondance de mots-clés sur le nom du fichier
 *    (tant qu'aucune catégorie explicite n'a été posée).
 *
 * Cela rend la conformité concrète : l'organisme voit ce qu'il lui reste à
 * déposer, le coordinateur repère d'un coup d'œil ce qui manque.
 */

import type { DossierFile, SubmissionStatus } from '../types';

export interface RequiredDoc {
  id: string;
  label: string;
  description: string;
  /** Mots-clés (sans accents, minuscules) pour l'auto-association par nom. */
  keywords: string[];
}

export const REQUIRED_DOCS: RequiredDoc[] = [
  { id: 'assurance', label: "Attestation d'assurance", description: 'Responsabilité civile en cours de validité.', keywords: ['assurance', 'rc', 'responsabilite', 'attestation assu'] },
  { id: 'statuts', label: "Statuts de l'organisme", description: "Statuts de l'association ou de la structure.", keywords: ['statut'] },
  { id: 'convention', label: 'Convention de partenariat', description: 'Convention signée avec Aviation Sans Frontières.', keywords: ['convention', 'partenariat'] },
  { id: 'identite', label: "Pièces d'identité", description: 'Pièces d\'identité des bénéficiaires / passagers.', keywords: ['identite', 'cni', 'passeport', 'carte didentite'] },
  { id: 'autorisation', label: 'Autorisations parentales', description: 'Autorisations pour les passagers mineurs.', keywords: ['autorisation', 'parental'] },
  { id: 'medical', label: 'Certificats médicaux', description: "Aptitude au vol des passagers.", keywords: ['medical', 'certificat med', 'aptitude'] },
];

const REQUIRED_IDS = new Set(REQUIRED_DOCS.map((d) => d.id));

/** Normalise une chaîne (minuscule, sans accents) pour la comparaison. */
function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Documents rattachés à une pièce (catégorie explicite, sinon mots-clés). */
export function matchFiles(files: DossierFile[], item: RequiredDoc): DossierFile[] {
  return files.filter((f) => {
    if (f.category) return f.category === item.id;
    const n = normalize(f.name);
    return item.keywords.some((k) => n.includes(normalize(k)));
  });
}

export type ChecklistItemState = 'missing' | 'pending' | 'incomplete' | 'validated';

export interface ChecklistEntry {
  item: RequiredDoc;
  state: ChecklistItemState;
  /** Statut le plus avancé parmi les documents rattachés (pour l'affichage). */
  status?: SubmissionStatus;
  count: number;
}

export interface ChecklistResult {
  entries: ChecklistEntry[];
  /** Pièces avec au moins un document validé. */
  validatedCount: number;
  /** Pièces avec au moins un document déposé (quel que soit le statut). */
  depositedCount: number;
  total: number;
  /** Pourcentage de complétude (pièces validées / total). */
  percent: number;
  /** Vrai si toutes les pièces obligatoires ont au moins un document déposé. */
  allDeposited: boolean;
  /** Pièces prêtes (déposées et non rejetées : validées ou en attente). */
  readyCount: number;
  /** Vrai si toutes les pièces sont prêtes (présentes et aucune rejetée). */
  submittable: boolean;
}

const RANK: Record<SubmissionStatus, number> = { Pending: 0, 'Under review': 1, Incomplete: 0, Validated: 2 };

export function computeChecklist(files: DossierFile[]): ChecklistResult {
  const entries: ChecklistEntry[] = REQUIRED_DOCS.map((item) => {
    const matches = matchFiles(files, item);
    if (matches.length === 0) {
      return { item, state: 'missing', count: 0 };
    }
    // Statut le plus avancé parmi les documents rattachés.
    let best = matches[0].submissionStatus || 'Pending';
    for (const f of matches) {
      const s = f.submissionStatus || 'Pending';
      if (RANK[s] > RANK[best]) best = s;
    }
    // Une pièce validée reste valide même si un autre document a été rejeté.
    // Sinon, un document rejeté (Incomplete) prime pour signaler la correction.
    const hasIncomplete = matches.some((f) => (f.submissionStatus || 'Pending') === 'Incomplete');
    const state: ChecklistItemState =
      best === 'Validated' ? 'validated' : hasIncomplete ? 'incomplete' : 'pending';
    return { item, state, status: best, count: matches.length };
  });

  const total = REQUIRED_DOCS.length;
  const validatedCount = entries.filter((e) => e.state === 'validated').length;
  const depositedCount = entries.filter((e) => e.count > 0).length;
  const readyCount = entries.filter((e) => e.state === 'validated' || e.state === 'pending').length;
  return {
    entries,
    validatedCount,
    depositedCount,
    readyCount,
    total,
    percent: total > 0 ? Math.round((validatedCount / total) * 100) : 0,
    allDeposited: total > 0 && depositedCount === total,
    submittable: total > 0 && readyCount === total,
  };
}

/** Options (constantes) pour un menu de classement d'un document. */
const CATEGORY_OPTIONS: { value: string; label: string }[] = REQUIRED_DOCS.map((d) => ({ value: d.id, label: d.label }));
export function categoryOptions(): { value: string; label: string }[] {
  return CATEGORY_OPTIONS;
}

/** Libellé d'une catégorie (ou repli sur la valeur brute). */
export function categoryLabel(id?: string): string {
  if (!id) return '';
  return REQUIRED_DOCS.find((d) => d.id === id)?.label || id;
}

export function isRequiredCategory(id?: string): boolean {
  return !!id && REQUIRED_IDS.has(id);
}
