import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Layers } from 'lucide-react';
import { AntenneGroup } from '../types';
import { useFeedback } from '../hooks/useFeedback';
import {
  createGroup,
  renameGroup,
  deleteGroup,
  toggleAntenneInGroup,
} from '../lib/antenneGroups';

interface AntenneGroupsManagerProps {
  groups: AntenneGroup[];
  antennes: { id: string; name: string }[];
}

const DEFAULT_GROUP_COLOR = '#1b98c4';

/**
 * Gestion des groupes thématiques d'antennes (super admin uniquement).
 * Permet de créer, renommer, supprimer des groupes et de gérer leurs antennes
 * membres (appartenance multiple).
 */
export default function AntenneGroupsManager({ groups, antennes }: AntenneGroupsManagerProps) {
  const { toast, confirm } = useFeedback();

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(DEFAULT_GROUP_COLOR);
  const [creating, setCreating] = useState(false);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_GROUP_COLOR);
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    if (name.length > 100) {
      toast('Le nom du groupe ne peut pas dépasser 100 caractères.', 'error');
      return;
    }
    setCreating(true);
    try {
      await createGroup(name, newGroupColor);
      setNewGroupName('');
      setNewGroupColor(DEFAULT_GROUP_COLOR);
      toast('Groupe créé avec succès.', 'success');
    } catch (err: any) {
      toast('Erreur lors de la création du groupe : ' + (err?.message || err), 'error');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (group: AntenneGroup) => {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditColor(group.color || DEFAULT_GROUP_COLOR);
  };

  const handleRename = async (group: AntenneGroup) => {
    const name = editName.trim();
    if (!name) return;
    if (name.length > 100) {
      toast('Le nom du groupe ne peut pas dépasser 100 caractères.', 'error');
      return;
    }
    setBusyGroupId(group.id);
    try {
      await renameGroup(group, name, editColor);
      setEditingGroupId(null);
      toast('Groupe mis à jour.', 'success');
    } catch (err: any) {
      toast('Erreur lors de la modification : ' + (err?.message || err), 'error');
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleDelete = async (group: AntenneGroup) => {
    if (!await confirm(`Supprimer le groupe "${group.name}" ? Les antennes ne sont pas supprimées, seulement le groupe.`)) return;
    setBusyGroupId(group.id);
    try {
      await deleteGroup(group.id);
      toast('Groupe supprimé.', 'success');
    } catch (err: any) {
      toast('Erreur lors de la suppression : ' + (err?.message || err), 'error');
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleToggleAntenne = async (group: AntenneGroup, antenneId: string) => {
    const include = !group.antenneIds.includes(antenneId);
    setBusyGroupId(group.id);
    try {
      await toggleAntenneInGroup(group, antenneId, include);
    } catch (err: any) {
      toast("Erreur lors de la mise à jour des membres : " + (err?.message || err), 'error');
    } finally {
      setBusyGroupId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-azur/10 text-azur flex items-center justify-center shrink-0">
          <Layers className="w-4.5 h-4.5" />
        </div>
        <div>
          <h4 className="text-xs font-display font-black text-deep dark:text-white uppercase tracking-wider">
            Groupes d'antennes
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Classez librement les antennes par thématique. Une antenne peut appartenir à plusieurs groupes.
          </p>
        </div>
      </div>

      {/* Création d'un nouveau groupe */}
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Nom du groupe</label>
          <input
            type="text"
            value={newGroupName}
            maxLength={100}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="ex: Antennes côtières"
            className="input-asf text-xs font-bold dark:bg-slate-950 dark:text-white dark:border-slate-700"
          />
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Couleur</label>
          <input
            type="color"
            value={newGroupColor}
            onChange={(e) => setNewGroupColor(e.target.value)}
            className="h-[38px] w-12 p-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl cursor-pointer"
            title="Couleur d'affichage du groupe"
          />
        </div>
        <button
          type="submit"
          disabled={creating || !newGroupName.trim()}
          className="btn-asf text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Créer</span>
        </button>
      </form>

      {/* Liste des groupes */}
      {groups.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          Aucun groupe pour l'instant. Créez-en un ci-dessus.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isEditing = editingGroupId === group.id;
            const busy = busyGroupId === group.id;
            return (
              <div
                key={group.id}
                className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-8 w-9 p-0.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={editName}
                        maxLength={100}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-asf flex-1 text-xs font-bold dark:bg-slate-950 dark:text-white dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleRename(group)}
                        disabled={busy || !editName.trim()}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer"
                        title="Enregistrer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingGroupId(null)}
                        className="p-1.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
                        title="Annuler"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: group.color || DEFAULT_GROUP_COLOR }}
                        />
                        <span className="text-xs font-display font-black text-deep dark:text-white truncate">{group.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {group.antenneIds.length} antenne(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(group)}
                          className="p-1.5 rounded-lg text-azur hover:bg-azur/10 cursor-pointer"
                          title="Renommer le groupe"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(group)}
                          disabled={busy}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                          title="Supprimer le groupe"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Antennes membres : toggle par antenne */}
                <div className="flex flex-wrap gap-1.5">
                  {antennes.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic">Aucune antenne disponible.</span>
                  ) : (
                    antennes.map((ant) => {
                      const member = group.antenneIds.includes(ant.id);
                      return (
                        <button
                          key={ant.id}
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleAntenne(group, ant.id)}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                            member
                              ? 'bg-azur text-white border-azur'
                              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-azur/50'
                          }`}
                          title={member ? `Retirer ${ant.name} du groupe` : `Ajouter ${ant.name} au groupe`}
                        >
                          {member ? '✓ ' : '+ '}{ant.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
