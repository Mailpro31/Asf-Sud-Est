import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { authErrorMessage } from '../lib/authErrors';
import { LogoASF } from './LandingPage';
import CessnaPlane from './CessnaPlane';

interface LoginProps {
  onNavigateRegister: () => void;
  onNavigateHome?: () => void;
}

type Mode = 'login' | 'reset';

export default function Login({ onNavigateRegister, onNavigateHome }: LoginProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const { themeConfig } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      setError(authErrorMessage(err, 'Échec de la connexion.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(authErrorMessage(err, 'Échec de la connexion avec Google.'));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Veuillez saisir votre adresse e-mail.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(`Un e-mail de réinitialisation a été envoyé à ${email.trim()}. Pensez à vérifier vos courriers indésirables.`);
    } catch (err: any) {
      setError(authErrorMessage(err, "Impossible d'envoyer l'e-mail de réinitialisation."));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setInfo('');
  };

  const borderStyle = `border ${themeConfig.cardBorder}`;

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center ${themeConfig.bg} ${themeConfig.fontFamily} p-4 md:p-8 transition-all duration-300 relative overflow-hidden`}>
      {/* Décor : halo + Cessna qui traverse discrètement le haut de l'écran */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-azur/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 bg-azur/10 rounded-full blur-3xl" />
      <div className="asf-plane-cross-slow absolute top-10 left-0 w-24 opacity-40 pointer-events-none">
        <CessnaPlane className="w-full" />
      </div>

      {onNavigateHome && (
        <button
          onClick={onNavigateHome}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-azur transition-colors cursor-pointer bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-3xs"
          id="back-to-home-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'accueil
        </button>
      )}

      <div className="w-full max-w-md relative">
        {/* En-tête */}
        <div className="mb-8 text-center flex flex-col items-center">
          <LogoASF className="w-16 h-16 mb-4 hover:scale-105 transition-transform duration-200" variant="color" />
          <h1 className="text-2xl font-bold tracking-tight text-deep font-display">
            Aviation Sans Frontières
          </h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
            Espace sécurisé pour déposer et suivre les documents des vols <span className="font-semibold text-deep">Les Ailes du Sourire</span>.
          </p>
        </div>

        {/* Carte */}
        <div className={`w-full p-8 sm:p-10 ${themeConfig.cardBg} ${borderStyle} rounded-2xl ${themeConfig.accentGlow} transition-all duration-300`}>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-deep font-display">
              {mode === 'login' ? 'Se connecter' : 'Mot de passe oublié'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'login'
                ? 'Saisissez vos identifiants pour accéder aux dossiers'
                : 'Recevez un lien de réinitialisation par e-mail'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-xl text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              <span>{info}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Adresse e-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-asf pl-10"
                    placeholder="organisation@exemple.org"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">Mot de passe</label>
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-[11px] font-semibold text-azur hover:text-azur-hover hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-asf pl-10 pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-asf w-full flex items-center justify-center gap-2 mt-6 cursor-pointer disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrer sur le portail'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Adresse e-mail du compte</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-asf pl-10"
                    placeholder="organisation@exemple.org"
                    autoComplete="email"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-asf w-full flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Envoyer le lien de réinitialisation'}
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-azur transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Revenir à la connexion
              </button>
            </form>
          )}

          {mode === 'login' && (
            <>
              <div className="mt-6 flex flex-col items-center">
                <div className="w-full flex items-center mb-6">
                  <div className="flex-1 border-t border-slate-200/60" />
                  <span className="px-3 text-[10px] uppercase tracking-widest text-slate-400 font-medium">ou se connecter avec</span>
                  <div className="flex-1 border-t border-slate-200/60" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="btn-secondary w-full flex justify-center items-center gap-2 text-sm font-semibold cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Connexion Google Workspace
                </button>
              </div>

              <div className="mt-8 text-center text-xs text-slate-500">
                Besoin d'identifiants d'accès ?{' '}
                <button onClick={onNavigateRegister} className="font-semibold text-azur hover:text-azur-hover transition hover:underline cursor-pointer">
                  Inscrivez votre organisation
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Connexion chiffrée · Vos données restent confidentielles
        </p>
      </div>
    </div>
  );
}
