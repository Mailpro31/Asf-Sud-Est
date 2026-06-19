import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { 
  ShieldAlert, 
  MapPin, 
  Building2, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  User,
  Phone,
  Mail,
  Lock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authErrorMessage } from '../lib/authErrors';
import { LogoASF } from './LandingPage';
import { localDb } from '../lib/localDb';

interface RegisterProps {
  onNavigateLogin: () => void;
  onNavigateHome?: () => void;
}

/**
 * Vérifie la robustesse d'un mot de passe.
 * Retourne un message d'erreur, ou null si le mot de passe est valide.
 */
function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule.';
  if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule.';
  if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial.';
  return null;
}

export default function Register({ onNavigateLogin, onNavigateHome }: RegisterProps) {
  // Wizard steps: 1 = Structure, 2 = Antenne, 3 = Connexion & Validation
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [selectedDelegation] = useState('france');
  const [selectedAntenne, setSelectedAntenne] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshOrganization, antennes } = useAuth();
  
  const { themeConfig } = useTheme();

  const savePendingRegistration = (dataToMerge: any) => {
    try {
      const existing = localStorage.getItem('asf_pending_registration');
      const parsed = existing ? JSON.parse(existing) : {};
      const merged = {
        name: formData.name,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        delegation_id: selectedDelegation,
        antenne_id: selectedAntenne,
        ...parsed,
        ...dataToMerge
      };
      localStorage.setItem('asf_pending_registration', JSON.stringify(merged));
    } catch (e) {
      console.warn("Could not save pending registration locally", e);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (step < 3) {
      handleNextStep();
      return;
    }

    if (!selectedAntenne) {
      setError('Veuillez sélectionner une Antenne régionale / Ville.');
      setStep(2);
      return;
    }

    const passwordError = validatePasswordStrength(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    savePendingRegistration({});
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Envoi (non bloquant) de l'email de vérification.
      try {
        await sendEmailVerification(user);
      } catch (verifErr) {
        console.warn('Envoi de l\'email de vérification impossible', verifErr);
      }

      const now = Date.now();
      
      // Save locally to localDb sandbox just in case Firestore fails or sandbox gets activated
      const localOrg = {
        id: user.uid,
        name: formData.name.trim(),
        contactName: formData.contactName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        submissionStatus: 'Pending' as const,
        role: 'organization' as const,
        delegation_id: selectedDelegation,
        antenne_id: selectedAntenne,
        createdAt: now,
        updatedAt: now,
      };
      localDb.saveOrganization(localOrg);

      await setDoc(doc(db, 'organizations', user.uid), {
        name: formData.name,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        submissionStatus: 'Pending', // Pending validation by delegation coordinators
        role: 'organization',
        delegation_id: selectedDelegation,
        antenne_id: selectedAntenne,
        createdAt: now,
        updatedAt: now,
      });

      // Clear pending state after successful create
      localStorage.removeItem('asf_pending_registration');
      await refreshOrganization();
    } catch (err: any) {
      setError(authErrorMessage(err, "Échec de l'inscription."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    savePendingRegistration({});
    try {
      await signInWithPopup(auth, provider);
      localStorage.removeItem('asf_pending_registration');
    } catch (err: any) {
      console.error(err);
      setError(authErrorMessage(err, "Échec de l'inscription avec Google."));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      savePendingRegistration({ [name]: value });
      return next;
    });
  };

  const handleNextStep = () => {
    setError('');
    if (step === 1) {
      if (!formData.name.trim() || !formData.phone.trim()) {
        setError("Veuillez renseigner le nom de l'organisme et son téléphone.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedAntenne) {
        setError("Veuillez sélectionner une Antenne de vol régionale pour la validation de vos dossiers.");
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setError('');
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const inputRounded = 'rounded-2xl';
  const borderStyle = `border ${themeConfig.cardBorder}`;
  
  // Clean antenna deduplication list
  const activeAntennesList = (Object.values(antennes || {}).flat() as { id: string; name: string }[])
    .filter((val, i, arr) => arr.findIndex(t => t.id === val.id) === i);

  const getAntenneName = (id: string) => {
    const found = activeAntennesList.find(a => a.id === id);
    return found ? found.name : '';
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center ${themeConfig.bg} ${themeConfig.fontFamily} p-4 md:p-8 transition-all duration-300 relative`}>
      {onNavigateHome && (
        <button 
          onClick={onNavigateHome}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-azur transition-colors cursor-pointer bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-3xs"
          id="back-to-home-btn"
        >
          ← Retour à l'accueil
        </button>
      )}
      <div className="w-full max-w-lg text-left">
        {/* Modern Minimal Headings */}
        <div className="mb-6 text-center flex flex-col items-center">
          <LogoASF className="w-16 h-16 mb-3 hover:scale-105 transition-transform duration-200" variant="color" />
          <h1 className="text-2xl font-black tracking-tight text-deep dark:text-white font-display">
            Aviation Sans Frontières
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed text-center">
            Ouvrez votre espace partenaire pour transmettre les documents des vols <span className="font-semibold text-azur">Les Ailes du Sourire</span>.
          </p>
        </div>

        {/* Stepper progress tracker bar */}
        <div className="mb-6 px-4 py-3 bg-slate-100/50 dark:bg-slate-900/45 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs">
          <button 
            type="button"
            onClick={() => step > 1 && setStep(1)}
            className={`flex items-center gap-1 font-bold ${step === 1 ? 'text-azur' : 'text-slate-400 dark:text-slate-500'} transition-all`}
          >
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${step === 1 ? 'bg-azur text-white' : step > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
              {step > 1 ? <Check className="w-3 h-3" /> : '1'}
            </span>
            <span className="hidden sm:inline">1. Organisme</span>
          </button>
          
          <div className="flex-1 h-0.5 mx-2 bg-slate-200 dark:bg-slate-800"></div>

          <button 
            type="button"
            onClick={() => step > 2 && setStep(2)}
            className={`flex items-center gap-1 font-bold ${step === 2 ? 'text-azur' : 'text-slate-400 dark:text-slate-500'} transition-all`}
          >
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${step === 2 ? 'bg-azur text-white' : step > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
              {step > 2 ? <Check className="w-3 h-3" /> : '2'}
            </span>
            <span className="hidden sm:inline">2. Implantation</span>
          </button>

          <div className="flex-1 h-0.5 mx-2 bg-slate-200 dark:bg-slate-800"></div>

          <div className={`flex items-center gap-1 font-bold ${step === 3 ? 'text-azur' : 'text-slate-400 dark:text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${step === 3 ? 'bg-azur text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
              3
            </span>
            <span className="hidden sm:inline">3. Sécurité</span>
          </div>
        </div>

        {/* Register Form Wrapper Card */}
        <div className={`w-full p-8 sm:p-10 ${themeConfig.cardBg} ${borderStyle} rounded-3xl ${themeConfig.accentGlow} shadow-xl transition-all duration-300 relative overflow-hidden`}>
          
          {/* Subtle watermarked decorative tag */}
          <div className="absolute top-0 right-0 p-3 bg-azur/10 text-azur rounded-bl-2xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> Étape {step}/3
          </div>

          <div className="mb-6 border-b pb-4 border-slate-100/60 dark:border-slate-800/80">
            {step === 1 && (
              <>
                <h2 className="text-lg font-black text-deep dark:text-white font-display uppercase tracking-tight">🏢 Qui êtes-vous ?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Identifiez la structure ou l'association sollicitant l'accès au réseau.</p>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="text-lg font-black text-deep dark:text-white font-display uppercase tracking-tight">📍 Antenne de Rattachement</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sélectionnez la section régionale chargée d'auditer vos licences indispensables.</p>
              </>
            )}
            {step === 3 && (
              <>
                <h2 className="text-lg font-black text-deep dark:text-white font-display uppercase tracking-tight">🔐 Vos Identifiants Sécurisés</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Définissez vos clés d'accès chiffrées réglementaires.</p>
              </>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* STEP 1: STRUCTURE INFO */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Nom complet de l'organisme / Institution</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="input-asf pl-10 font-semibold shadow-3xs"
                      placeholder="Ex. Association Perce-Neige Nantes"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Téléphone d'urgence opérationnelle</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="input-asf pl-10 font-mono font-medium shadow-3xs"
                      placeholder="+33 2 40 12 34 56"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: REGIONAL ASSOCIATION */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-azur" />
                    <span>Sélectionner votre Section Régionale de vol</span>
                  </label>
                  <select
                    value={selectedAntenne}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedAntenne(val);
                      savePendingRegistration({ antenne_id: val });
                    }}
                    required
                    className={`w-full px-4 py-3 border ${themeConfig.cardBorder} ${inputRounded} bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-azur/20 focus:border-azur text-sm font-bold transition-all shadow-3xs`}
                  >
                    <option value="">-- Choisir l'antenne locale de proximité --</option>
                    {activeAntennesList.map(a => (
                      <option key={a.id} value={a.id}>ASF • {a.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                
                {selectedAntenne && (
                  <div className="p-4 bg-azur/5 rounded-2xl border border-azur/15 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                    <p className="font-bold text-deep dark:text-slate-200">📍 Antenne validante sélectionnée :</p>
                    <p className="font-mono">Aviation Sans Frontières • <span className="underline font-bold text-azur uppercase">{getAntenneName(selectedAntenne)}</span></p>
                    <p className="mt-2 text-[11px] leading-relaxed italic text-slate-500">
                      C'est le coordinateur d'ASF basé dans ce centre de vol qui recevra vos documents réglementaires et autorisera l'accès au réseau Ailes du Sourire.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: LOGINS & VALIDATION */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Coordinateur référent (Nom / Prénom)</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      name="contactName"
                      required
                      value={formData.contactName}
                      onChange={handleChange}
                      className="input-asf pl-10 font-semibold shadow-3xs"
                      placeholder="Ex. Jean DUPONT"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Email réglementaire de connexion</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="input-asf pl-10 shadow-3xs"
                      placeholder="directeur@perce-neige.org"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Mot de passe de chiffrement</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="input-asf pl-10 shadow-3xs"
                      placeholder="Minimum 12 caractères"
                      minLength={12}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial.
                  </p>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS ROW */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100/60 dark:border-slate-800/80">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="btn-secondary flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Précédent
                </button>
              ) : (
                <div /> // Spactor
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-3xs ml-auto"
                >
                  Continuer <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-asf flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider cursor-pointer ml-auto"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Créer mon Compte Partenaire <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Social provider registrations is only appropriate at step 1 */}
          {step === 1 && (
            <div className="mt-6 flex flex-col items-center">
              <div className="w-full flex items-center mb-5">
                <div className="flex-1 border-t border-slate-200/60 dark:border-slate-800"></div>
                <span className="px-3 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black">ou s'enregistrer avec</span>
                <div className="flex-1 border-t border-slate-200/60 dark:border-slate-800"></div>
              </div>
              
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="btn-secondary w-full flex justify-center items-center gap-2 text-xs font-bold cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Compte Google Workspace
              </button>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-slate-500">
            Déjà inscrit auprès de l'organisation Aviation Sans Frontières ?{' '}
            <button onClick={onNavigateLogin} className="font-bold text-azur hover:underline cursor-pointer">
              Se connecter à l'espace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
