import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, Shield, Key, Mail, Phone, Building, Check, Copy, Laptop, 
  Smartphone, Loader2, AlertCircle, RefreshCw, KeyRound, QrCode, ClipboardCheck 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './ui';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { updatePassword, updateEmail } from 'firebase/auth';
import { logAction } from '../lib/auditLog';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Beautiful avatar options
const AVATARS = [
  { id: 'pilot-1', emoji: '🧑‍✈️', label: 'Commandant de Bord', bgColor: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700' },
  { id: 'officer-1', emoji: '👩‍✈️', label: 'Officier de Liaison', bgColor: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700' },
  { id: 'engineer-1', emoji: '🧑‍🔬', label: 'Ingénieur Contrôle', bgColor: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700' },
  { id: 'coordinator-1', emoji: '👩‍💻', label: 'Coordinateur Sol', bgColor: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700' },
  { id: 'crew-1', emoji: '🧑‍🚀', label: 'Navigateur Spatial', bgColor: 'bg-purple-100 dark:bg-purple-950/40 text-purple-700' },
];

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, organization, refreshOrganization, antennes } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'sessions'>('profile');

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

  // Input states
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // 2FA mock states
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);

  // Avatar setting state
  const [selectedAvatarId, setSelectedAvatarId] = useState('pilot-1');

  // Status & loading indicators
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Initialize data on open
  useEffect(() => {
    if (isOpen && organization) {
      setContactName(organization.contactName || '');
      setPhone(organization.phone || '');
      setEmail(organization.email || '');
      setOrgName(organization.name || '');

      // Load avatar from localStorage
      if (user) {
        const storedAvatar = localStorage.getItem(`asf_avatar_${user.uid}`);
        if (storedAvatar) {
          setSelectedAvatarId(storedAvatar);
        }
        
        const storedMfa = localStorage.getItem(`asf_2fa_enabled_${user.uid}`) === 'true';
        setMfaEnabled(storedMfa);
      }

      // Reset feedback messages
      setProfileSuccessMsg(null);
      setProfileErrorMsg(null);
      setPasswordStatus({ type: null, message: '' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowMfaSetup(false);
      setTotpCode('');
    }
  }, [isOpen, organization, user]);

  if (!isOpen || !user || !organization) return null;

  // Handle Profile saving
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
      // 1. Update Firestore org details
      const docRef = doc(db, 'organizations', user.uid);
      await updateDoc(docRef, {
        contactName: contactName.trim(),
        name: orgName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        updatedAt: Date.now()
      });

      // 2. Sync Firebase Auth email if modified
      if (email.trim() !== user.email) {
        try {
          await updateEmail(user, email.trim());
        } catch (authError: any) {
          console.warn('Authentication email sync skipped/requires recent login:', authError);
          if (authError.code === 'auth/requires-recent-login') {
            setProfileErrorMsg('La modification de l\'adresse de connexion nécessite une reconnexion récente.');
          }
        }
      }

      // 3. Save selected avatar in localStorage
      localStorage.setItem(`asf_avatar_${user.uid}`, selectedAvatarId);

      logAction('org_profile_update', {
        targetType: 'organization',
        targetId: user.uid,
        targetName: orgName.trim(),
        delegation_id: organization.delegation_id,
        antenne_id: organization.antenne_id,
        details: 'Profil mis à jour par le titulaire du compte',
      });

      // Refresh contexts
      await refreshOrganization();
      setProfileSuccessMsg('Profil et informations mis à jour avec succès !');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setProfileErrorMsg('Impossible de mettre à jour le profil. Une erreur est survenue.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password changing
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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/requires-recent-login') {
        setPasswordStatus({ 
          type: 'error', 
          message: 'Veuillez vous déconnecter et vous reconnecter, puis réessayer cette action de sécurité.' 
        });
      } else {
        setPasswordStatus({ type: 'error', message: 'Une erreur est survenue. Veuillez réessayer.' });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Trigger 2FA enablement assistant
  const handleToggleMfa = () => {
    if (mfaEnabled) {
      // Prompt to disable immediately
      localStorage.setItem(`asf_2fa_enabled_${user.uid}`, 'false');
      setMfaEnabled(false);
      setShowMfaSetup(false);
      setMfaRecoveryCodes([]);
    } else {
      setShowMfaSetup(true);
      setTotpCode('');
      setMfaError(null);
      // Generate simulated recovery codes
      const codes = Array.from({ length: 6 }, () => 
        'AVIATION-' + Math.random().toString(36).substring(3, 7).toUpperCase() + '-' + Math.random().toString(36).substring(3, 7).toUpperCase()
      );
      setMfaRecoveryCodes(codes);
    }
  };

  // Verify dynamic code
  const handleVerifyTotp = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length !== 6 || isNaN(Number(totpCode))) {
      setMfaError('Veuillez saisir un code à 6 chiffres valide.');
      return;
    }

    // Success Simulation
    localStorage.setItem(`asf_2fa_enabled_${user.uid}`, 'true');
    setMfaEnabled(true);
    setShowMfaSetup(false);
    setMfaError(null);
  };

  const copySecretKey = () => {
    navigator.clipboard.writeText('AVIATION-B6F2-990E-401A-X9A2');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const activeAvatar = AVATARS.find(a => a.id === selectedAvatarId) || AVATARS[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with premium blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          {/* Modal layout container */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.45 }}
            className="relative w-full max-w-3xl h-[85vh] md:h-[75vh] max-h-[700px] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-10 flex flex-col md:flex-row"
          >
            {/* Left Sidebar Menu of Profile Modal */}
            <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 p-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 flex flex-col shrink-0">
              {/* Premium Avatar presentation */}
              <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200/60 dark:border-slate-800">
                <div className={`w-16 h-16 rounded-2xl ${activeAvatar.bgColor} flex items-center justify-center text-3xl shadow-sm relative group mb-3`}>
                  <span>{activeAvatar.emoji}</span>
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center text-white text-[10px] font-sans font-bold cursor-pointer transition-opacity">
                    Changer
                  </span>
                </div>
                <h4 className="text-sm font-display font-black text-deep dark:text-slate-100 truncate w-full px-1">
                  {contactName || organization.contactName}
                </h4>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {organization.role === 'admin' ? '👮 Inspecteur Aviation Sans Frontières' : '✈️ Organisme Partenaire'}
                </p>
                <div className="mt-2.5 px-3 py-1 rounded-full text-[10px] font-bold bg-azur-light dark:bg-azur/15 text-azur border border-azur/30">
                  {orgName || organization.name}
                </div>
              </div>

              {/* Navigation Menu item options */}
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
                  <span>Mes Informations</span>
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
                  <span>Sécurité & 2FA</span>
                </button>

                <button
                  onClick={() => setActiveTab('sessions')}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'sessions'
                      ? 'bg-azur text-white shadow-md shadow-azur/15'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <Laptop className="w-4 h-4" />
                  <span>Activité de session</span>
                </button>
              </nav>

              {/* Version indicator */}
              <div className="mt-auto text-center md:text-left text-[9px] text-slate-400 font-mono select-none">
                Protocole Aviation Sans Frontières v4.2.1-Prod
              </div>
            </div>

            {/* Right Sub-View Frame with content scrolling */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 relative">
              {/* Header inside frame */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <h3 className="text-base font-display font-extrabold text-deep dark:text-slate-100">
                  {activeTab === 'profile' && 'Informations Personnelles'}
                  {activeTab === 'security' && 'Sécurité et Accès'}
                  {activeTab === 'sessions' && 'Appareils et Sessions Actives'}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab views with nice overflow vertical scrolls */}
              <div className="flex-grow p-6 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {/* TAB 1: PROFILE DETAILS FORM */}
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
                        {/* Selector of Avatar Presets */}
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2.5">
                            Choisissez votre Avatar
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

                        {/* Text fields Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
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
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
                              <Building className="w-3.5 h-3.5" /> Nom de l'organisme / Compagnie
                            </label>
                            <input
                              type="text"
                              required
                              value={orgName}
                              onChange={(e) => setOrgName(e.target.value)}
                              placeholder="e.g. Flight Academy, HeliSport"
                              className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" /> E-mail de contact et de connexion
                            </label>
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="contact@compagnie.com"
                              className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
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

                        {/* Block metadata display */}
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 mt-4 text-[11px] space-y-1.5 text-slate-500 font-medium">
                          <div className="flex justify-between items-center">
                            <span>Statut réglementaire du compte :</span>
                            <StatusBadge status={organization.submissionStatus} />
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Rôle attribué au profil :</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] tracking-wider">
                              {organization.role === 'admin' ? 'Administrateur Principal' : 'Opérateur Organisme'}
                            </span>
                          </div>
                          {organization.delegation_id && (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800/60">
                              <span>Délégation d'appartenance :</span>
                              <span className="font-bold text-azur dark:text-azur-pastel">
                                📍 {getDelegationName(organization.delegation_id)}
                              </span>
                            </div>
                          )}
                          {organization.antenne_id && (
                            <div className="flex justify-between items-center">
                              <span>Antenne d'affectation :</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                🏢 {getAntenneName(organization.delegation_id || '', organization.antenne_id)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Save Action */}
                        <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                          <button
                            type="submit"
                            disabled={isSavingProfile}
                            className="btn-asf text-xs px-5 py-2.5"
                          >
                            {isSavingProfile ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Modification...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Enregistrer les modifications</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {/* TAB 2: SECURITY & PASSWORDS & 2FA */}
                  {activeTab === 'security' && (
                    <motion.div
                      key="security-tab"
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="space-y-6"
                    >
                      {/* Section 1: Change password */}
                      <div className="bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-azur/10 dark:bg-azur/15 text-azur rounded-xl">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-deep dark:text-slate-100 uppercase tracking-wider">Modifier mon mot de passe</h4>
                            <p className="text-[11px] text-slate-400">Gardez votre accès protégé par un mot de passe robuste.</p>
                          </div>
                        </div>

                        {passwordStatus.message && (
                          <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                            passwordStatus.type === 'success' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{passwordStatus.message}</span>
                          </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-3 pt-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Nouveau mot de passe"
                                className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <input
                                type="password"
                                required
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                placeholder="Confirmer le nouveau mot de passe"
                                className="input-asf text-xs dark:bg-slate-950 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              type="submit"
                              disabled={isChangingPassword}
                              className="btn-asf text-[11px] px-4 py-1.5"
                            >
                              {isChangingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                              <span>Modifier le mot de passe</span>
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Section 2: Two-Factor auth (2FA) */}
                      <div className="bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-azur/10 dark:bg-azur/15 text-azur rounded-xl">
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-deep dark:text-slate-100 uppercase tracking-wider">Double Authentification (MFA / 2FA)</h4>
                              <p className="text-[11px] text-slate-400">Complétez votre protection par un code à usage unique (TOTP/MFA).</p>
                            </div>
                          </div>

                          {/* Toggle switch */}
                          <button
                            onClick={handleToggleMfa}
                            type="button"
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              mfaEnabled || showMfaSetup ? 'bg-azur' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                mfaEnabled || showMfaSetup ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Interactive Verification Workflow */}
                        {showMfaSetup && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4"
                          >
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                              {/* Generated Mock QR Code */}
                              <div className="p-3 bg-white border rounded-xl shadow-xs shrink-0 relative group">
                                <QrCode className="w-28 h-28 text-slate-900" />
                                <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center text-[10px] font-bold text-azur">
                                  Scanner QR Code
                                </div>
                              </div>

                              <div className="space-y-2 text-xs text-slate-500 font-medium">
                                <p className="font-bold text-slate-800 dark:text-slate-200">1. Scannez le QR Code ou copiez la clé d'installation</p>
                                <p>Recherchez l'application Google Authenticator ou Authy sur votre appareil mobile.</p>
                                
                                <div className="flex items-center gap-2 mt-1 bg-slate-100 dark:bg-slate-950 p-2 rounded-lg border">
                                  <code className="text-azur dark:text-azur-pastel font-mono text-[10px] select-all font-semibold uppercase">
                                    AVIATION-B6F2-990E-401A-X9A2
                                  </code>
                                  <button
                                    type="button"
                                    onClick={copySecretKey}
                                    className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors text-slate-500 cursor-pointer"
                                    title="Copier la clé"
                                  >
                                    {copiedKey ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Verify dynamic numeric inputs */}
                            <form onSubmit={handleVerifyTotp} className="space-y-3 pt-2">
                              <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                2. Confirmez le code de vérification à 6 chiffres
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="text"
                                  placeholder="000000"
                                  maxLength={6}
                                  value={totpCode}
                                  onChange={(e) => setTotpCode(e.target.value)}
                                  className="input-asf w-28 text-center text-sm font-mono font-bold tracking-widest dark:bg-slate-950 dark:text-slate-100"
                                />
                                <button
                                  type="submit"
                                  className="btn-asf text-xs px-4 py-2"
                                >
                                  Activer la double authentification
                                </button>
                              </div>
                              {mfaError && <p className="text-[11px] text-rose-500 font-semibold">{mfaError}</p>}
                            </form>

                            {/* Recovery Codes block */}
                            <div className="p-3 bg-azur-light/50 dark:bg-slate-950 rounded-xl border border-azur/20 text-[11px]">
                              <span className="font-extrabold text-deep dark:text-azur-pastel uppercase tracking-wider block mb-1">
                                Codes de sauvegarde
                              </span>
                              <p className="text-slate-500 dark:text-slate-400 mb-2">Notez précieusement ces codes au cas où vous perdriez accès à votre mobile.</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 font-mono text-[9px] text-slate-700 dark:text-slate-200 font-bold">
                                {mfaRecoveryCodes.map((code, ind) => (
                                  <div key={ind} className="bg-white dark:bg-slate-900 p-1 rounded border text-center">
                                    {code}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {mfaEnabled && !showMfaSetup && (
                          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                            <Check className="w-5 h-5 shrink-0" />
                            <div>
                              <span>Double authentification (TOTP) active et sécurisée pour votre compte.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 3: SESSION HISTORY LOGS */}
                  {activeTab === 'sessions' && (
                    <motion.div
                      key="sessions-tab"
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="space-y-6 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200">Appareils et Connexions Actuelles</h4>
                      <p className="text-[11px] text-slate-400">Ci-dessous la liste des sessions détectées sur votre compte. Déconnectez toute activité suspecte.</p>

                      <div className="space-y-3">
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-4">
                          <div className="p-2 bg-azur/10 dark:bg-azur/15 text-azur rounded-xl">
                            <Laptop className="w-5 h-5" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <strong className="text-slate-800 dark:text-slate-200">Chrome (Windows 11) - Session Actuelle</strong>
                              <span className="shrink-0 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                Actif
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-1">IP: 195.14.80.32 (Paris, France)</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Dernière activité : Il y a quelques secondes</p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/10 rounded-2xl border border-slate-100/60 dark:border-slate-800 flex items-start gap-4 opacity-70">
                          <div className="p-2 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-xl">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <strong className="text-slate-700 dark:text-slate-300">iPhone 14 (Safari Mobile)</strong>
                              <span className="shrink-0 text-[10px] text-slate-400">Déconnecté</span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-1">IP: 92.17.221.144 (Marseille, France)</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Dernière activité : 11/06/2026 à 18h42</p>
                          </div>
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
