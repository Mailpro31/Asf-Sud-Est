import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { localDb } from './localDb';
import { AntenneGroup } from '../types';

/**
 * API d'écriture pour les groupes d'antennes.
 * Gère de manière transparente le mode "sandbox" local (localDb) et Firestore,
 * en repliant automatiquement sur le sandbox en cas de dépassement de quota.
 * Les écritures Firestore sont réservées au super admin (cf. firestore.rules).
 */

function isQuotaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('quota') || msg.includes('limit exceeded') ||
         msg.includes('resource-exhausted') || msg.includes('insufficient');
}

function newLocalId(): string {
  return 'grp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function createGroup(name: string, color?: string): Promise<void> {
  const now = Date.now();
  const base = {
    name: name.trim(),
    color: color || null,
    antenneIds: [] as string[],
    createdAt: now,
    updatedAt: now,
  };

  if (localDb.isSandboxActive()) {
    localDb.saveGroup({ id: newLocalId(), ...base, color: color || undefined });
    return;
  }
  try {
    await addDoc(collection(db, 'antenne_groups'), base);
  } catch (err) {
    if (isQuotaError(err)) {
      localDb.setSandboxActive(true);
      localDb.saveGroup({ id: newLocalId(), ...base, color: color || undefined });
      return;
    }
    throw err;
  }
}

export async function renameGroup(group: AntenneGroup, name: string, color?: string): Promise<void> {
  const updated: AntenneGroup = {
    ...group,
    name: name.trim(),
    color: color !== undefined ? (color || undefined) : group.color,
    updatedAt: Date.now(),
  };

  if (localDb.isSandboxActive()) {
    localDb.saveGroup(updated);
    return;
  }
  try {
    await updateDoc(doc(db, 'antenne_groups', group.id), {
      name: updated.name,
      color: updated.color ?? null,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    if (isQuotaError(err)) {
      localDb.setSandboxActive(true);
      localDb.saveGroup(updated);
      return;
    }
    throw err;
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  if (localDb.isSandboxActive()) {
    localDb.deleteGroup(groupId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'antenne_groups', groupId));
  } catch (err) {
    if (isQuotaError(err)) {
      localDb.setSandboxActive(true);
      localDb.deleteGroup(groupId);
      return;
    }
    throw err;
  }
}

/** Remplace la liste complète des antennes d'un groupe. */
export async function setGroupAntennes(group: AntenneGroup, antenneIds: string[]): Promise<void> {
  const updated: AntenneGroup = { ...group, antenneIds, updatedAt: Date.now() };
  if (localDb.isSandboxActive()) {
    localDb.saveGroup(updated);
    return;
  }
  try {
    await updateDoc(doc(db, 'antenne_groups', group.id), {
      antenneIds,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    if (isQuotaError(err)) {
      localDb.setSandboxActive(true);
      localDb.saveGroup(updated);
      return;
    }
    throw err;
  }
}

/** Ajoute ou retire une antenne d'un groupe (toggle). */
export async function toggleAntenneInGroup(group: AntenneGroup, antenneId: string, include: boolean): Promise<void> {
  const has = group.antenneIds.includes(antenneId);
  if (include === has) return;
  const antenneIds = include
    ? [...group.antenneIds, antenneId]
    : group.antenneIds.filter(id => id !== antenneId);
  await setGroupAntennes(group, antenneIds);
}

/**
 * Synchronise l'appartenance d'une antenne avec une sélection de groupes.
 * Ajoute l'antenne aux groupes sélectionnés, la retire des autres.
 */
export async function setAntenneMembership(
  antenneId: string,
  selectedGroupIds: string[],
  allGroups: AntenneGroup[]
): Promise<void> {
  const selected = new Set(selectedGroupIds);
  for (const group of allGroups) {
    const shouldInclude = selected.has(group.id);
    const has = group.antenneIds.includes(antenneId);
    if (shouldInclude !== has) {
      await toggleAntenneInGroup(group, antenneId, shouldInclude);
    }
  }
}

/** Retire une antenne de tous les groupes (nettoyage à la suppression de l'antenne). */
export async function removeAntenneFromAllGroups(antenneId: string, allGroups: AntenneGroup[]): Promise<void> {
  if (localDb.isSandboxActive()) {
    localDb.removeAntenneFromAllGroups(antenneId);
    return;
  }
  for (const group of allGroups) {
    if (group.antenneIds.includes(antenneId)) {
      try {
        await updateDoc(doc(db, 'antenne_groups', group.id), {
          antenneIds: group.antenneIds.filter(id => id !== antenneId),
          updatedAt: Date.now(),
        });
      } catch (err) {
        if (isQuotaError(err)) {
          localDb.setSandboxActive(true);
          localDb.removeAntenneFromAllGroups(antenneId);
          return;
        }
        throw err;
      }
    }
  }
}
