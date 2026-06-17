import React, { useEffect, useMemo, useState } from 'react';
import { UserCog, Mail, Trash2, Plus, Clock, MapPin, ShieldCheck, Copy } from 'lucide-react';
import { useFeedback } from '../hooks/useFeedback';
import { AntenneInvite, Organization } from '../types';
import {
  subscribeInvites,
  upsertInvite,
  deleteInvite,
  inviteKey,
  assignOrgAsAntenneAdmin,
  revokeOrgAntenneAdmin,
  queueEmail,
} from '../lib/antenneAdmins';

interface Props {
  orgProfiles: Organization[];
  delegations: { id: string; name: string }[];
  antennes: Record<string, { id: string; name: string }[]>;
}

/**
 * Gestion simple, par e-mail, des gestionnaires d'antennes (super admin).
 *
 * Le super admin saisit un e-mail + une antenne : si le compte existe déjà il
 * est promu immédiatement, sinon une invitation est créée et appliquée
 * automatiquement à la première connexion de la personne.
 */
export default function AntenneAdminsManager({ orgProfiles, delegations, antennes }: Props) {
  const { toast, confirm } = useFeedback();
  const [invites, setInvites] = useState<AntenneInvite[]>([]);
  const [email, setEmail] = useState('');
  const [delegationId, setDelegationId] = useState('');
  const [antenneId, setAntenneId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeInvites(setInvites), []);

  const antenneName = (delId: string, antId: string) =>
    (antennes[delId] || []).find((a) => a.id === antId)?.name || antId;

  const delegationName = (delId: string) =>
    delegations.find((d) => d.id === delId)?.name || delId;

  // Comptes déjà gestionnaires d'antenne
  const currentAdmins = useMemo(
    () => orgProfiles.filter((o) => o.role === 'admin_antenne'),
    [orgProfiles],
  );

  // Invitations sans compte gestionnaire encore actif (en attente de 1ère connexion)
  const pendingInvites = useMemo(() => {
    const adminEmails = new Set(currentAdmins.map((o) => (o.email || '').toLowerCase()));
    return invites.filter((i) => !adminEmails.has(i.id));
  }, [invites, currentAdmins]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteKey(email);
    if (!cleanEmail || !delegationId || !antenneId) {
      toast('Renseignez un e-mail, une délégation et une antenne.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await upsertInvite(cleanEmail, delegationId, antenneId);
      // Si un compte existe déjà avec cet e-mail, on l'attribue tout de suite.
      const existing = orgProfiles.find((o) => (o.email || '').toLowerCase() === cleanEmail);
      const antName = antenneName(delegationId, antenneId);
      const delName = delegationName(delegationId);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      if (existing) {
        await assignOrgAsAntenneAdmin(existing, delegationId, antenneId);
      }

      // Envoi automatique de l'e-mail (extension Firebase « Trigger Email »).
      const subject = `Gestion de l'antenne ${antName} — ASF Dossiers`;
      const text = buildInviteMessage(cleanEmail, delegationId, antenneId);
      const html =
        `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.6">` +
        `<h2 style="color:#0e5e76;margin:0 0 12px">Vous gérez désormais l'antenne ${antName}</h2>` +
        `<p>Bonjour,</p>` +
        `<p>Vous avez été désigné(e) gestionnaire de l'antenne <strong>${antName}</strong> (${delName}) sur le portail <strong>ASF Dossiers</strong>.</p>` +
        (existing
          ? `<p>Votre compte est déjà actif : connectez-vous pour accéder au tableau de bord de votre antenne.</p>`
          : `<p>Pour activer votre accès, créez votre compte en utilisant exactement cette adresse e-mail : <strong>${cleanEmail}</strong>. Vous accéderez alors automatiquement au tableau de bord de votre antenne.</p>`) +
        `<p style="margin:20px 0"><a href="${origin}" style="background:#1b98c4;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-weight:600">Accéder au portail</a></p>` +
        `<p style="color:#64748b;font-size:13px">Aviation Sans Frontières</p>` +
        `</div>`;
      const sent = await queueEmail(cleanEmail, subject, text, html);

      if (existing) {
        toast(
          `${cleanEmail} est gestionnaire de l'antenne ${antName}.` + (sent ? ' E-mail envoyé.' : ''),
          'success',
        );
      } else {
        toast(
          sent
            ? `Invitation envoyée par e-mail à ${cleanEmail}.`
            : `Invitation créée pour ${cleanEmail}. (E-mail non envoyé : extension absente — utilisez « Copier ».)`,
          sent ? 'success' : 'warning',
        );
      }
      setEmail('');
      setAntenneId('');
    } catch (err: any) {
      console.error('Assign antenne admin failed:', err);
      toast("Échec de l'attribution : " + (err?.message || 'erreur inconnue'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeAdmin = async (org: Organization) => {
    if (!(await confirm(`Retirer le rôle de gestionnaire à ${org.email} ?`))) return;
    try {
      await revokeOrgAntenneAdmin(org);
      await deleteInvite((org.email || '').toLowerCase());
      toast('Rôle de gestionnaire retiré.', 'success');
    } catch (err: any) {
      toast('Échec de la révocation : ' + (err?.message || 'erreur'), 'error');
    }
  };

  const buildInviteMessage = (email: string, delId: string, antId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return (
      `Bonjour,\n\n` +
      `Vous êtes invité(e) à devenir gestionnaire de l'antenne « ${antenneName(delId, antId)} » ` +
      `(${delegationName(delId)}) sur le portail ASF Dossiers.\n\n` +
      `Pour activer votre accès :\n` +
      `1. Rendez-vous sur ${origin}\n` +
      `2. Créez votre compte en utilisant exactement cette adresse e-mail : ${email}\n\n` +
      `Vous accéderez alors automatiquement au tableau de bord de votre antenne.\n\n` +
      `À bientôt,\nAviation Sans Frontières`
    );
  };

  const handleCopyInvite = async (invite: AntenneInvite) => {
    const message = buildInviteMessage(invite.email, invite.delegation_id, invite.antenne_id);
    try {
      await navigator.clipboard.writeText(message);
      toast("Message d'invitation copié — collez-le dans votre e-mail.", 'success');
    } catch {
      // Repli si l'API clipboard est indisponible
      window.prompt('Copiez ce message d\'invitation :', message);
    }
  };

  const handleDeleteInvite = async (invite: AntenneInvite) => {
    if (!(await confirm(`Annuler l'invitation de ${invite.email} ?`))) return;
    try {
      await deleteInvite(invite.id);
      toast('Invitation annulée.', 'success');
    } catch (err: any) {
      toast("Échec de l'annulation : " + (err?.message || 'erreur'), 'error');
    }
  };

  return (
    <div className="card-asf p-6 space-y-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-azur-light text-azur flex items-center justify-center shrink-0">
          <UserCog className="w-5 h-5" />
        </span>
        <div>
          <h3 className="font-display text-deep font-bold tracking-tight">Gestionnaires d'antennes</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Attribuez une antenne à un e-mail. Si le compte existe, l'accès est immédiat ; sinon, copiez l'invitation (bouton <span className="inline-flex align-middle"><Copy className="w-3 h-3" /></span>) et envoyez-la — l'accès s'activera à sa première connexion.
          </p>
        </div>
      </div>

      {/* Formulaire d'attribution par e-mail */}
      <form onSubmit={handleAssign} className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5 sm:col-span-3 lg:col-span-1">
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">E-mail du gestionnaire</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@exemple.org"
                className="input-asf pl-10"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Délégation</label>
            <select
              value={delegationId}
              onChange={(e) => {
                setDelegationId(e.target.value);
                setAntenneId('');
              }}
              className="input-asf"
            >
              <option value="">Sélectionner…</option>
              {delegations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Antenne</label>
            <select
              value={antenneId}
              onChange={(e) => setAntenneId(e.target.value)}
              disabled={!delegationId}
              className="input-asf disabled:opacity-50"
            >
              <option value="">Sélectionner…</option>
              {(antennes[delegationId] || []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={busy} className="btn-asf">
          <Plus className="w-4 h-4" /> Attribuer
        </button>
      </form>

      {/* Gestionnaires actifs */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Gestionnaires actifs ({currentAdmins.length})
        </p>
        {currentAdmins.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">Aucun gestionnaire d'antenne pour le moment.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {currentAdmins.map((org) => (
              <div key={org.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50/70">
                <span className="w-8 h-8 rounded-lg bg-azur/10 text-azur flex items-center justify-center shrink-0 text-xs font-bold">
                  {(org.contactName || org.email || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-deep truncate">{org.email}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-azur" />
                    {antenneName(org.delegation_id || '', org.antenne_id || '')} · {delegationName(org.delegation_id || '')}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeAdmin(org)}
                  className="btn-ghost p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                  title="Retirer le rôle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invitations en attente */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" /> Invitations en attente ({pendingInvites.length})
          </p>
          <div className="divide-y divide-amber-100 rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900 truncate">{inv.email}</p>
                  <p className="text-[11px] text-amber-700 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" />
                    {antenneName(inv.delegation_id, inv.antenne_id)} · {delegationName(inv.delegation_id)} — en attente de connexion
                  </p>
                </div>
                <button
                  onClick={() => handleCopyInvite(inv)}
                  className="btn-ghost p-2 text-amber-800 hover:bg-amber-100 shrink-0"
                  title="Copier le message d'invitation à envoyer"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteInvite(inv)}
                  className="btn-ghost p-2 text-amber-700 hover:bg-amber-100 shrink-0"
                  title="Annuler l'invitation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
