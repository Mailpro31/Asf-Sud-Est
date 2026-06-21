import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Shield, Key, Mail, Phone, Building, Check, Loader2, AlertCircle,
  KeyRound, Eye, EyeOff, LogOut, MailCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './ui';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { updatePassword, updateEmail, sendPasswordResetEmail } from 'firebase/auth';
import { logAction } from '../lib/auditLog';
import { authErrorMessage } from '../lib/authErrors';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Avatars proposés (stockés en local, purement décoratifs).
const AVATARS = [
  { id: 'pilot-1', emoji: '🧑‍✈️', label: 'Commandant de Bord', bgColor: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700' },
  { id: 'officer-1', emoji: '👩‍✈️', label: 'Officier de Liaison', bgColor: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700' },
  { id: 'engineer-1', emoji: '🧑‍🔬', label: 'Ingénieur Contrôle', bgColor: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700' },
  { id: 'coordinator-1', emoji: '👩‍💻', label: 'Coordinateur Sol', bgColor: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700' },
  { id: 'crew-1', emoji: '🧑‍🚀', label: 'Navigateur', bgColor: 'bg-purple-100 dark:bg-purple-950/40 text-purple-700' },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super administrateur',
  admin: 'Administrateur national',
  admin_antenne: "Gestionnaire d'antenne",
  admin_delegation: 'Coordinateur',
  organization: 'Organisme partenaire',
};

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, organization, refreshOrganization, antennes, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  const getDelegationName = (id: string) => {
    const list = [
      { id: 'ouest', name: 'Délégation Ouest' },
      { id: 'occitanie', name: 'Délégation Occitanie Toulouse' },
      { id: 'sud-est', name: 'Délégation Sud-Est' },
      { id: 'antilles', name: 'Délégation Antilles' },
    ];
    return list.find(d => d.id === id)?.name || id;
  };

  const getAntenneName = (delId: string, antId: string) => {
    const list = antennes[delId || 'france'] || [];
    return list.find(a => a.id === antId)?.name || antId;
  };

  // Champs profil
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');

  // Changement de mot de passe
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Réinitialisation par e-mail
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [sendingReset, setSendingReset] = useState(false);

  // Avatar
  const [selectedAvatarId, setSelectedAvatarId] = useState('pilot-1');

  // États de chargement / messages
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && organization) {
      setContactName(organization.contactName || '');
      setPhone(organization.phone || '');
      setEmail(organization.email || '');
      setOrgName(organization.name || '');

      if (user) {
        const storedAvatar = localStorage.getItem(`asf_avatar_${user.uid}`);
        if (storedAvatar) setSelectedAvatarId(storedAvatar);
      }

      setProfileSuccessMsg(null);
      setProfileErrorMsg(null);
      setPasswordStatus({ type: null, message: '' });
      setResetStatus({ type: null, message: '' });
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPassword(false);
    }
  }, [isOpen, organization, user]);

  if (!isOpen || !user || !organization) return null;

  // --- Enregistrement du profil ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !orgName.trim() || !email.trim()) {
      setProfileErrorMsg('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsSavingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    try {
      const docRef = doc(db, 'organizations', user.uid);
      await updateDoc(docRef, {
        contactName: contactName.trim(),
        name: orgName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        updatedAt: Date.now(),
      });

      // Synchronise l'e-mail de connexion Firebase Auth si modifié.
      if (email.trim() !== user.email) {
        try {
          await updateEmail(user, email.trim());
        } catch (authError: any) {
          console.warn('Sync e-mail Auth ignorée :', authError);
          if (authError.code === 'auth/requires-recent-login') {
            setProfileErrorMsg("Les informations sont enregistrées, mais la modification de l'e-mail de connexion nécessite une reconnexion récente.");
          }
        }
      }

      localStorage.setItem(`asf_avatar_${user.uid}`, selectedAvatarId);

      logAction('org_profile_update', {
        targetType: 'organization',
        targetId: user.uid,
        targetName: orgName.trim(),
        delegation_id: organization.delegation_id,
        antenne_id: organization.antenne_id,
        details: 'Profil mis à jour par le titulaire du compte',
      });

      await refreshOrganization();
      if (!profileErrorMsg) setProfileSuccessMsg('Profil et informations mis à jour avec succès !');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setProfileErrorMsg('Impossible de mettre à jour le profil. Une erreur est survenue.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Changement de mot de passe ---
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus({ type: null, message: '' });

    if (!newPassword || !confirmNewPassword) {
      setPasswordStatus({ type: 'error', message: 'Veuillez saisir votre nouveau mot de passe.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Le mot de passe doit comporter au moins 6 caractères.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus({ type: 'error', message: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await updatePassword(user, newPassword);
      setPasswordStatus({ type: 'success', message: 'Votre mot de passe a été modifié avec succès !' });
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      setPasswordStatus({ type: 'error', message: authErrorMessage(error) });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // --- Réinitialisation par e-mail (utile si reconnexion requise) ---
  const handleSendReset = async () => {
    setResetStatus({ type: null, message: '' });
    const target = (user.email || email).trim();
    if (!target) {
      setResetStatus({ type: 'error', message: 'Aucune adresse e-mail associée au compte.' });
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, target);
      setResetStatus({ type: 'success', message: `Un e-mail de réinitialisation a été envoyé à ${target}.` });
    } catch (error: any) {
      setResetStatus({ type: 'error', message: authErrorMessage(error, "Impossible d'envoyer l'e-mail.") });
    } finally {
      setSendingReset(false);
    }
  };

  const activeAvatar = AVATARS.find(a => a.id === selectedAvatarId) || AVATARS[0];
  const roleLabel = ROLE_LABEL[organization.role || 'organization'] || 'Organisme partenaire';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.45 }}
            className="relative w-full max-w-3xl h-[85vh] md:h-[72vh] max-h-[680px] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-10 flex flex-col md:flex-row"
          >
            {/* Barre latérale */}
            <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 p-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 flex flex-col shrink-0">
              <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200/60 dark:border-slate-800">
                <div className={`w-16 h-16 rounded-2xl ${activeAvatar.bgColor} flex items-center justify-center text-3xl shadow-sm mb-3`}>
                  <span>{activeAvatar.emoji}</span>
                </div>
                <h4 className="text-sm font-display font-black text-deep dark:text-slate-100 truncate w-full px-1">
                  {contactName || organization.contactName}
                </h4>
                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mt-0.5">
                  {roleLabel}
                </p>
                <div className="mt-2.5 px-3 py-1 rounded-full text-[10px] font-bold bg-azur-light dark:bg-azur/15 text-azur border border-azur/30 truncate max-w-full">
                  {orgName || organization.name}
                </div>
              </div>

              <nav className="flex-grow mt-6 space-y-1">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-azur text-white shadow-md shadow-azur/15'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Mes informations</span>
                </button>

                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'security'
                      ? 'bg-azur text-white shadow-md shadow-azur/15'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Sécurité</span>
                </button>
              </nav>

              <button
                onClick={() => signOut()}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Se déconnecter
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 relative">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <h3 className="text-base font-display font-extrabold text-deep dark:text-slate-100">
                  {activeTab === 'profile' ? 'Informations personnelles' : 'Sécurité et accès'}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-grow p-6 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {/* ONGLET PROFIL */}
                  {activeTab === 'profile' && (
                    <motion.div
                      key="profile-tab"
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="space-y-6"
                    >
                      {profileSuccessMsg && (
                        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{profileSuccessMsg}</span>
                        </div>
                      )}
                      {profileErrorMsg && (
                        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{profileErrorMsg}</span>
                        </div>
                      )}

                      <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2.5">
                            Choisissez votre avatar
                          </label>
                          <div className="grid grid-cols-5 gap-2.5">
                            {AVATARS.map((av) => (
                              <button
                                key={av.id}
                                type="button"
                                onClick={() => setSelectedAvatarId(av.id)}
                                className={`h-11 rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer relative ${av.bgColor} ${
                                  selectedAvatarId === av.id
                                    ? 'ring-2 ring-azur ring-offset-2 dark:ring-offset-slate-900 scale-105'
                                    : 'opacity-70 hover:opacity-100'
                                }`}
                                title={av.label}
                              >
                                <span>{av.emoji}</span>
                                {selectedAvatarId === av.id && (
                                  <span className="absolute -top-1 -right-1 bg-azur text-white rounded-full p-0.5 border border-white dark:border-slate-800">
                                    <Check className="w-1.5 h-1.5" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                              <User className="w-3.5 h-3.5" /> Nom complet
                            </label>
                            <input
                              type="text"
                              required
                              value={contactName}
                              onChange={(e) => setContactName(e.target.value)}
                              placeholder="Jean Dupont"
                              className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                              <Building className="w-3.5 h-3.5" /> Nom de l'organisme
                            </label>
                            <input
                              type="text"
                              required
                              value={orgName}
                              onChange={(e) => setOrgName(e.target.value)}
                              placeholder="ex. Graine 2 Vie"
                              className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" /> E-mail de contact et de connexion
                            </label>
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="contact@organisme.org"
                              className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" /> Téléphone de contact
                            </label>
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="+33 6 12 34 56 78"
                              className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 mt-4 text-[11px] space-y-1.5 text-slate-500 dark:text-slate-400 font-medium">
                          <div className="flex justify-between items-center">
                            <span>Statut du compte :</span>
                            <StatusBadge status={organization.submissionStatus} />
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Rôle attribué :</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] tracking-wider">
                              {roleLabel}
                            </span>
                          </div>
                          {organization.delegation_id && (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800/60">
                              <span>Délégation :</span>
                              <span className="font-bold text-azur dark:text-azur-pastel">
                                📍 {getDelegationName(organization.delegation_id)}
                              </span>
                            </div>
                          )}
                          {organization.antenne_id && (
                            <div className="flex justify-between items-center">
                              <span>Antenne :</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                🏢 {getAntenneName(organization.delegation_id || '', organization.antenne_id)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                          <button type="submit" disabled={isSavingProfile} className="btn-asf text-xs px-5 py-2.5 disabled:opacity-60">
                            {isSavingProfile ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Enregistrement…</span></>
                            ) : (
                              <><Check className="w-3.5 h-3.5" /><span>Enregistrer les modifications</span></>
                            )}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {/* ONGLET SÉCURITÉ */}
                  {activeTab === 'security' && (
                    <motion.div
                      key="security-tab"
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="space-y-6"
                    >
                      {/* Changement de mot de passe */}
                      <div className="bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-azur/10 dark:bg-azur/15 text-azur rounded-xl">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-deep dark:text-slate-100 uppercase tracking-wider">Modifier mon mot de passe</h4>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">Choisissez un mot de passe d'au moins 6 caractères.</p>
                          </div>
                        </div>

                        {passwordStatus.message && (
                          <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                            passwordStatus.type === 'success'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/30'
                              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-500/30'
                          }`}>
                            {passwordStatus.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                            <span>{passwordStatus.message}</span>
                          </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Nouveau mot de passe"
                                className="input-asf text-xs pr-9 dark:bg-slate-950 dark:text-slate-100"
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                title={showPassword ? 'Masquer' : 'Afficher'}
                              >
                                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              value={confirmNewPassword}
                              onChange={(e) => setConfirmNewPassword(e.target.value)}
                              placeholder="Confirmer le mot de passe"
                              className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                              autoComplete="new-password"
                            />
                          </div>
                          <div className="flex justify-end pt-1">
                            <button type="submit" disabled={isChangingPassword} className="btn-asf text-[11px] px-4 py-1.5 disabled:opacity-60">
                              {isChangingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                              <span>Modifier le mot de passe</span>
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Réinitialisation par e-mail */}
                      <div className="bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-azur/10 dark:bg-azur/15 text-azur rounded-xl">
                            <MailCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-deep dark:text-slate-100 uppercase tracking-wider">Réinitialiser par e-mail</h4>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              Recevez un lien sécurisé sur <strong>{user.email}</strong> (utile si la modification directe demande une reconnexion).
                            </p>
                          </div>
                        </div>

                        {resetStatus.message && (
                          <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                            resetStatus.type === 'success'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/30'
                              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-500/30'
                          }`}>
                            {resetStatus.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                            <span>{resetStatus.message}</span>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button onClick={handleSendReset} disabled={sendingReset} className="btn-secondary text-[11px] px-4 py-1.5 disabled:opacity-60">
                            {sendingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MailCheck className="w-3.5 h-3.5" />}
                            <span>Envoyer le lien de réinitialisation</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
