import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useTheme, themeOptions } from '../context/ThemeContext';
import { LogoASF } from './LandingPage';

interface LoginProps {
  onNavigateRegister: () => void;
  onNavigateHome?: () => void;
}

export default function Login({ onNavigateRegister, onNavigateHome }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { theme, setTheme, themeConfig } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Échec de la connexion.');
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
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Échec de la connexion avec Google.');
    }
  };

  const inputRounded = 'rounded-xl';
  const borderStyle = `border ${themeConfig.cardBorder}`;

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center ${themeConfig.bg} ${themeConfig.fontFamily} p-4 md:p-8 transition-all duration-300 relative`}>
      {onNavigateHome && (
        <button 
          onClick={onNavigateHome}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1b98c4] transition-colors cursor-pointer bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-3xs"
          id="back-to-home-btn"
        >
          ← Retour à l'accueil
        </button>
      )}
      <div className="w-full max-w-md">
        {/* Modern Minimal Headings */}
        <div className="mb-8 text-center flex flex-col items-center">
          <LogoASF className="w-16 h-16 mb-4 hover:scale-105 transition-transform duration-200" variant="color" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans font-display">
            Aviation Sans Frontières
          </h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
            Portail autorisé pour les secours d'urgence, les permis de vol et la logistique humanitaire.
          </p>
        </div>

        {/* Login Form Wrapper Card */}
        <div className={`w-full p-8 sm:p-10 ${themeConfig.cardBg} ${borderStyle} rounded-2xl ${themeConfig.accentGlow} transition-all duration-300`}>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 font-display">Se connecter</h2>
            <p className="text-xs text-slate-500 mt-1">Saisissez vos identifiants pour accéder aux dossiers</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Adresse Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-2.5 border ${themeConfig.cardBorder} ${inputRounded} bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-azur/20 focus:border-azur text-sm transition-all`}
                placeholder="organisation@aviation-sans-frontieres-fr.org"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2.5 border ${themeConfig.cardBorder} ${inputRounded} bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-azur/20 focus:border-azur text-sm transition-all`}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 ${themeConfig.btnPrimary} flex items-center justify-center gap-2 mt-6 cursor-pointer`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Entrer sur le portail'
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center">
            <div className="w-full flex items-center mb-6">
              <div className="flex-1 border-t border-slate-200/60"></div>
              <span className="px-3 text-[10px] uppercase tracking-widest text-slate-400 font-medium">ou se connecter avec</span>
              <div className="flex-1 border-t border-slate-200/60"></div>
            </div>
            
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className={`w-full py-2.5 px-4 ${themeConfig.btnSecondary} flex justify-center items-center gap-2 text-sm font-semibold cursor-pointer`}
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
        </div>
      </div>
    </div>
  );
}
