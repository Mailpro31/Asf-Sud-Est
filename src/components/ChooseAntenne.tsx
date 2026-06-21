/**
 * Onboarding « Choix de l'antenne ».
 *
 * Affiché lorsqu'un compte « organisation » n'a pas encore d'antenne de
 * rattachement — c'est notamment le cas après une inscription / création de
 * compte via Google, où l'antenne n'est pas demandée pendant le flux OAuth.
 * L'utilisateur choisit ici son antenne validante, puis son profil est
 * complété et il accède à son espace.
 */

import React, { useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { MapPin, LogOut, ArrowRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { localDb } from '../lib/localDb';
import { LogoASF } from './LandingPage';

export default function ChooseAntenne() {
  const { user, organization, antennes, refreshOrganization, signOut } = useAuth();
  const { themeConfig } = useTheme();
  const [selectedAntenne, setSelectedAntenne] = useState(organization?.antenne_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Liste dédupliquée de toutes les antennes (toutes délégations).
  const activeAntennesList = useMemo(
    () =>
      (Object.values(antennes || {}).flat() as { id: string; name: string }[]).filter(
        (val, i, arr) => arr.findIndex((t) => t.id === val.id) === i,
      ),
    [antennes],
  );

  const getAntenneName = (id: string) => activeAntennesList.find((a) => a.id === id)?.name || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedAntenne) {
      setError('Veuillez sélectionner votre antenne de rattachement.');
      return;
    }
    if (!user) return;

    setLoading(true);
    const now = Date.now();

    // Document complet : l'écran « Choix de l'antenne » s'affiche soit pour un
    // compte dont le document n'existe pas encore (1re connexion Google, création
    // différée), soit pour un compte sans antenne. On écrit donc l'intégralité du
    // profil pour que l'opération soit une « création » valide.
    const fullDoc = {
      name: organization?.name || user.displayName || 'Compagnie Partenaire',
      contactName: organization?.contactName || user.displayName || 'Contact',
      email: organization?.email || user.email || '',
      phone: organization?.phone || '',
      submissionStatus: organization?.submissionStatus || 'Pending',
      role: 'organization' as const,
      delegation_id: 'france',
      antenne_id: selectedAntenne,
      createdAt: organization?.createdAt || now,
      updatedAt: now,
    };

    // Mise à jour locale (sandbox), en fusionnant avec le profil courant si
    // aucun enregistrement local n'existe encore (cas d'une inscription Google).
    const persistLocal = () => {
      try {
        const existing = localDb.getOrganizations().find((o) => o.id === user.uid);
        const base = existing || (organization ? { ...organization } : {});
        localDb.saveOrganization({ ...base, ...fullDoc, id: user.uid } as any);
      } catch (err) {
        console.warn('Could not update local organization', err);
      }
    };
    persistLocal();

    try {
      await setDoc(doc(db, 'organizations', user.uid), fullDoc, { merge: true });
      await refreshOrganization();
    } catch (err: any) {
      console.error('Failed to set antenne:', err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('quota') || msg.includes('limit exceeded') || msg.includes('permission') || msg.includes('insufficient')) {
        localDb.setSandboxActive(true);
        persistLocal();
        await refreshOrganization();
      } else {
        setError("Impossible d'enregistrer votre antenne. Veuillez réessayer.");
      }
    } finally {
      // Toujours réarmer le bouton : si l'enregistrement a réussi, App démonte
      // cet écran ; sinon l'utilisateur peut réessayer sans rester bloqué.
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center ${themeConfig.bg} ${themeConfig.fontFamily} p-4 md:p-8 transition-all duration-300`}>
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-azur-light dark:bg-azur/15 flex items-center justify-center mb-3">
            <LogoASF className="w-9 h-9" />
          </div>
          <h1 className="font-display text-2xl font-bold text-deep dark:text-white tracking-tight">
            Dernière étape : votre antenne
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md">
            Bienvenue{organization?.contactName ? ` ${organization.contactName.split(' ')[0]}` : ''} ! Choisissez l'antenne
            d'Aviation Sans Frontières qui validera vos dossiers et autorisera votre accès au réseau Ailes du Sourire.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-asf p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-azur" />
              <span>Sélectionner votre antenne de rattachement</span>
            </label>
            <select
              value={selectedAntenne}
              onChange={(e) => setSelectedAntenne(e.target.value)}
              required
              className={`w-full px-4 py-3 border ${themeConfig.cardBorder} rounded-2xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-azur/20 focus:border-azur text-sm font-bold transition-all shadow-3xs`}
            >
              <option value="">-- Choisir l'antenne locale de proximité --</option>
              {activeAntennesList.map((a) => (
                <option key={a.id} value={a.id}>ASF • {a.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {selectedAntenne && (
            <div className="p-4 bg-azur/5 rounded-2xl border border-azur/15 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
              <p className="font-bold text-deep dark:text-slate-200">📍 Antenne validante sélectionnée :</p>
              <p className="font-mono">Aviation Sans Frontières • <span className="underline font-bold text-azur uppercase">{getAntenneName(selectedAntenne)}</span></p>
              <p className="mt-2 text-[11px] leading-relaxed italic text-slate-500 dark:text-slate-400">
                C'est le coordinateur d'ASF basé dans ce centre de vol qui recevra vos documents réglementaires.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/30 rounded-xl px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading || !selectedAntenne} className="btn-asf w-full justify-center disabled:opacity-60">
            {loading ? 'Enregistrement…' : 'Accéder à mon espace'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <button
          onClick={() => signOut()}
          className="mt-4 mx-auto flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
