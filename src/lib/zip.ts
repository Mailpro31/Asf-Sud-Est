import { DossierFile } from '../types';
import { resolveFileUrl, downloadFile } from './fileTransfer';

/**
 * Générateur d'archive ZIP minimal (méthode « store », sans compression) —
 * 100 % côté navigateur, sans dépendance npm. Suffisant pour regrouper des
 * documents déjà compressés (PDF, images, bureautique) en un seul fichier.
 *
 * Format ZIP classique : en-tête local + données par fichier, puis un
 * répertoire central, puis l'enregistrement de fin (EOCD).
 */

// --- CRC32 (table précalculée) ---
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry { name: string; data: Uint8Array }

/** Assemble une archive ZIP (store) à partir d'entrées { nom, octets }. */
export function buildZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v: number) =>
    new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    // En-tête local
    const local = concat([
      u32(0x04034b50), // signature
      u16(20),         // version nécessaire
      u16(0x0800),     // drapeau : nom de fichier UTF-8
      u16(0),          // méthode : stockage
      u16(0), u16(0),  // heure / date (0)
      u32(crc),
      u32(size),       // taille compressée
      u32(size),       // taille décompressée
      u16(nameBytes.length),
      u16(0),          // longueur extra
      nameBytes,
    ]);
    parts.push(local, e.data);

    // Entrée du répertoire central
    central.push(concat([
      u32(0x02014b50), // signature
      u16(20), u16(20),
      u16(0x0800),
      u16(0),
      u16(0), u16(0),
      u32(crc),
      u32(size), u32(size),
      u16(nameBytes.length),
      u16(0), u16(0), // extra / commentaire
      u16(0),         // disque
      u16(0),         // attributs internes
      u32(0),         // attributs externes
      u32(offset),    // décalage de l'en-tête local
      nameBytes,
    ]));

    offset += local.length + size;
  }

  const centralBlob = concat(central);
  const eocd = concat([
    u32(0x06054b50),
    u16(0), u16(0),
    u16(entries.length), u16(entries.length),
    u32(centralBlob.length),
    u32(offset),
    u16(0),
  ]);

  return new Blob([concat(parts), centralBlob, eocd], { type: 'application/zip' });
}

function concat(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of arrs) { out.set(a, p); p += a.length; }
  return out;
}

/** Récupère les octets d'un fichier (URL http/Storage ou data URL base64). */
async function fetchBytes(file: DossierFile): Promise<Uint8Array | null> {
  const url = await resolveFileUrl(file);
  if (!url) return null;
  if (url.startsWith('data:')) {
    const base64 = url.slice(url.indexOf(',') + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  // URL http : peut échouer (CORS) → l'appelant gère le repli.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Dé-doublonne les noms de fichiers dans une archive (« a.pdf », « a (1).pdf »). */
function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) { i++; candidate = `${base} (${i})${ext}`; }
  used.add(candidate);
  return candidate;
}

export interface ZipResult { zipped: number; failed: DossierFile[] }

/**
 * Télécharge un lot de documents regroupés dans une archive .zip.
 * Les fichiers dont les octets sont inaccessibles (CORS Storage, contenu
 * manquant) sont renvoyés dans `failed` pour un repli (téléchargement unitaire).
 */
export async function downloadFilesAsZip(
  files: DossierFile[],
  zipName: string,
): Promise<ZipResult> {
  const entries: ZipEntry[] = [];
  const failed: DossierFile[] = [];
  const used = new Set<string>();

  for (const f of files) {
    try {
      const bytes = await fetchBytes(f);
      if (!bytes) { failed.push(f); continue; }
      entries.push({ name: uniqueName(f.name || 'document', used), data: bytes });
    } catch (e) {
      console.warn('ZIP: fichier ignoré', f.name, e);
      failed.push(f);
    }
  }

  if (entries.length > 0) {
    const blob = buildZip(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Repli : pour les fichiers non zippables, on déclenche le téléchargement unitaire.
  for (const f of failed) {
    try { await downloadFile(f); } catch { /* best-effort */ }
  }

  return { zipped: entries.length, failed };
}
