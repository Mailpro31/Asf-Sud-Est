import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { localDb } from './localDb';
import { queueEmail } from './antenneAdmins';

/**
 * Échappe les caractères HTML d'une valeur fournie par un utilisateur (nom
 * d'organisme, contact, nom de fichier…) avant de l'insérer dans le corps HTML
 * d'un e-mail. Empêche l'injection de balises/liens (phishing) dans la boîte
 * mail du gestionnaire d'antenne.
 */
function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Réglages par antenne, configurés par le gestionnaire d'antenne (admin_antenne).
 *
 * Principal usage : activer une notification e-mail envoyée à une adresse choisie
 * à chaque dépôt de dossier ou de fichier par un partenaire de l'antenne.
 *
 * Stocké dans `antenne_settings/{antenneId}` (repli localStorage en sandbox).
 */

export interface AntenneSettings {
  /** E-mail à chaque nouveau dépôt (fichier/dossier) d'un partenaire. */
  notifyEnabled: boolean;
  /** E-mail quand un nouvel organisme rejoint l'antenne. */
  notifyNewUserEnabled: boolean;
  notifyEmail: string;
}

const DEFAULT_SETTINGS: AntenneSettings = { notifyEnabled: false, notifyNewUserEnabled: false, notifyEmail: '' };

const LS_KEY = 'asf_antenne_settings';

function readLocal(): Record<string, AntenneSettings> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLocal(map: Record<string, AntenneSettings>) {
  localStorage.setItem(LS_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event('localdb-update'));
}

/** Lit les réglages d'une antenne (jamais `null` : valeurs par défaut sinon). */
export async function getAntenneSettings(antenneId: string): Promise<AntenneSettings> {
  if (!antenneId) return { ...DEFAULT_SETTINGS };
  if (localDb.isSandboxActive()) {
    return readLocal()[antenneId] || { ...DEFAULT_SETTINGS };
  }
  try {
    const snap = await getDoc(doc(db, 'antenne_settings', antenneId));
    if (!snap.exists()) return { ...DEFAULT_SETTINGS };
    const d = snap.data();
    return {
      notifyEnabled: !!d.notifyEnabled,
      notifyNewUserEnabled: !!d.notifyNewUserEnabled,
      notifyEmail: typeof d.notifyEmail === 'string' ? d.notifyEmail : '',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Abonnement temps réel aux réglages d'une antenne. */
export function subscribeAntenneSettings(
  antenneId: string,
  cb: (s: AntenneSettings) => void,
): () => void {
  if (!antenneId) {
    cb({ ...DEFAULT_SETTINGS });
    return () => {};
  }
  if (localDb.isSandboxActive()) {
    const load = () => cb(readLocal()[antenneId] || { ...DEFAULT_SETTINGS });
    load();
    window.addEventListener('localdb-update', load);
    return () => window.removeEventListener('localdb-update', load);
  }
  try {
    return onSnapshot(
      doc(db, 'antenne_settings', antenneId),
      (snap) => {
        if (!snap.exists()) {
          cb({ ...DEFAULT_SETTINGS });
          return;
        }
        const d = snap.data();
        cb({
          notifyEnabled: !!d.notifyEnabled,
          notifyNewUserEnabled: !!d.notifyNewUserEnabled,
          notifyEmail: typeof d.notifyEmail === 'string' ? d.notifyEmail : '',
        });
      },
      () => cb({ ...DEFAULT_SETTINGS }),
    );
  } catch {
    cb({ ...DEFAULT_SETTINGS });
    return () => {};
  }
}

/** Enregistre les réglages d'une antenne. */
export async function saveAntenneSettings(
  antenneId: string,
  settings: AntenneSettings,
): Promise<void> {
  const clean: AntenneSettings = {
    notifyEnabled: !!settings.notifyEnabled,
    notifyNewUserEnabled: !!settings.notifyNewUserEnabled,
    notifyEmail: settings.notifyEmail.trim(),
  };
  if (localDb.isSandboxActive()) {
    const map = readLocal();
    map[antenneId] = clean;
    writeLocal(map);
    return;
  }
  await setDoc(
    doc(db, 'antenne_settings', antenneId),
    { ...clean, updatedAt: Date.now() },
    { merge: true },
  );
}

/**
 * Notifie par e-mail le gestionnaire d'antenne d'un nouveau dépôt, si la
 * notification est activée pour l'antenne. Échec silencieux (ne bloque jamais
 * l'upload).
 */
export async function notifyAntenneOnUpload(
  antenneId: string | undefined | null,
  kind: 'file' | 'folder',
  name: string,
  context: { partnerName?: string; antenneName?: string } = {},
): Promise<void> {
  if (!antenneId) return;
  try {
    const settings = await getAntenneSettings(antenneId);
    if (!settings.notifyEnabled || !settings.notifyEmail) return;

    const what = kind === 'folder' ? 'un nouveau dossier' : 'un nouveau fichier';
    const partner = context.partnerName ? ` par ${context.partnerName}` : '';
    const antenne = context.antenneName || antenneId;
    const subject = `ASF · ${kind === 'folder' ? 'Nouveau dossier' : 'Nouveau fichier'} — ${antenne}`;
    const text =
      `Bonjour,\n\n${what.charAt(0).toUpperCase()}${what.slice(1)} vient d'être déposé${partner} ` +
      `sur l'antenne ${antenne} :\n\n• ${name}\n\nConnectez-vous au portail ASF pour le consulter.\n\n— Portail ASF`;
    const html =
      `<div style="font-family:Arial,sans-serif;color:#0f172a">` +
      `<p>Bonjour,</p>` +
      `<p><strong>${what.charAt(0).toUpperCase()}${what.slice(1)}</strong> vient d'être déposé${escHtml(partner)} ` +
      `sur l'antenne <strong>${escHtml(antenne)}</strong> :</p>` +
      `<p style="background:#f1f5f9;padding:10px 14px;border-radius:8px;font-weight:600">📄 ${escHtml(name)}</p>` +
      `<p>Connectez-vous au portail ASF pour le consulter.</p>` +
      `<p style="color:#64748b;font-size:13px">Aviation Sans Frontières</p>` +
      `</div>`;
    await queueEmail(settings.notifyEmail, subject, text, html);
  } catch (err) {
    console.warn('notifyAntenneOnUpload échec (non bloquant) :', err);
  }
}

/**
 * Notifie par e-mail le gestionnaire d'antenne qu'un NOUVEL organisme vient de
 * rejoindre son antenne, si la notification « nouvel organisme » est activée.
 * Échec silencieux (ne bloque jamais la création de compte).
 */
/** Organismes déjà notifiés pendant cette session (anti-doublon : plusieurs
 *  chemins — AuthContext, ChooseAntenne, repli sandbox — peuvent appeler la
 *  notification pour le même compte). */
const notifiedNewOrgIds = new Set<string>();

export async function notifyAntenneOnNewOrg(
  antenneId: string | undefined | null,
  context: { orgId?: string; orgName?: string; contactName?: string; email?: string; phone?: string; antenneName?: string } = {},
): Promise<void> {
  if (!antenneId) return;
  if (context.orgId) {
    if (notifiedNewOrgIds.has(context.orgId)) return; // déjà notifié
    notifiedNewOrgIds.add(context.orgId);
  }
  try {
    const settings = await getAntenneSettings(antenneId);
    if (!settings.notifyNewUserEnabled || !settings.notifyEmail) return;

    const antenne = context.antenneName || antenneId;
    const who = context.orgName || context.contactName || 'Un nouvel organisme';
    const lines: string[] = [];
    if (context.contactName) lines.push(`Contact : ${context.contactName}`);
    if (context.email) lines.push(`E-mail : ${context.email}`);
    if (context.phone) lines.push(`Téléphone : ${context.phone}`);
    const details = lines.length ? `\n\n${lines.join('\n')}` : '';

    const subject = `ASF · Nouvel organisme — ${antenne}`;
    const text =
      `Bonjour,\n\nUn nouvel organisme vient de rejoindre votre antenne ${antenne} :\n\n• ${who}${details}\n\n` +
      `Son compte est en attente de validation. Connectez-vous au portail ASF pour le valider.\n\n— Portail ASF`;
    const html =
      `<div style="font-family:Arial,sans-serif;color:#0f172a">` +
      `<p>Bonjour,</p>` +
      `<p><strong>Un nouvel organisme</strong> vient de rejoindre votre antenne <strong>${escHtml(antenne)}</strong> :</p>` +
      `<p style="background:#f1f5f9;padding:10px 14px;border-radius:8px;font-weight:600">🏢 ${escHtml(who)}</p>` +
      (lines.length
        ? `<p style="color:#334155;font-size:13px">${lines.map((l) => escHtml(l)).join('<br>')}</p>`
        : '') +
      `<p>Son compte est <strong>en attente de validation</strong>. Connectez-vous au portail ASF pour le valider.</p>` +
      `<p style="color:#64748b;font-size:13px">Aviation Sans Frontières</p>` +
      `</div>`;
    await queueEmail(settings.notifyEmail, subject, text, html);
  } catch (err) {
    console.warn('notifyAntenneOnNewOrg échec (non bloquant) :', err);
  }
}
