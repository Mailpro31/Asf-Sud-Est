import React, { useEffect, useRef, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { MailCheck, Loader2, ShieldCheck, Send, LogOut, CheckCircle2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authErrorMessage } from '../lib/authErrors';
import { LogoASF } from './LandingPage';
import { ThemeToggle } from './ui';

/** Délai (s) avant de pouvoir renvoyer un e-mail de vérification (anti-spam /
 *  limite Firebase). */
const RESEND_COOLDOWN_S = 60;

/**
 * Écran de garde affiché après l'inscription, tant que l'adresse e-mail n'a pas
 * été confirmée. Bloque l'accès au tableau de bord pour les comptes
 * e-mail/mot de passe non vérifiés (les comptes Google sont vérifiés d'office).
 *
 * L'utilisateur peut : renvoyer le lien (avec compte à rebours), revenir après
 * avoir cliqué sur le lien (re-contrôle automatique au retour sur l'onglet), ou
 * changer de compte (déconnexion).
 */
export default function VerifyEmail() {
  const { user, signOut } = useAuth();
  const { themeConfig } = useTheme();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Évite des contrôles concurrents (clic manuel + retour d'onglet simultanés).
  const checkingRef = useRef(false);

  // Compte à rebours du bouton « renvoyer ».
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Re-demande à Firebase l'état de confirmation. `silent` masque le message
  // « pas encore confirmé » lors des contrôles automatiques (retour d'onglet).
  const checkVerified = async (silent: boolean) => {
    const u = auth.currentUser;
    if (!u || checkingRef.current) return;
    checkingRef.current = true;
    if (!silent) {
      setChecking(true);
      setError('');
      setInfo('');
    }
    try {
      await u.reload();
      if (u.emailVerified) {
        // Recharge l'app : le flux d'authentification ré-évalue l'accès et
        // ouvre le tableau de bord adapté au rôle.
        window.location.reload();
        return;
      }
      if (!silent) {
        setInfo("Votre adresse n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail, puis réessayez.");
      }
    } catch (e) {
      if (!silent) setError(authErrorMessage(e, "Impossible de vérifier l'état de votre adresse."));
    } finally {
      checkingRef.current = false;
      if (!silent) setChecking(false);
    }
  };

  // Re-contrôle automatiquement : une fois au montage (cas d'une appli rouverte
  // avec un jeton « non vérifié » périmé alors que l'adresse a été confirmée
  // entre-temps), puis chaque fois que l'utilisateur revient sur l'onglet (après
  // avoir cliqué sur le lien dans sa boîte mail), pour ouvrir l'espace sans
  // qu'il ait à recliquer sur un bouton.
  useEffect(() => {
    checkVerified(true);
    const onFocus = () => checkVerified(true);
    // `visibilitychange` se déclenche AUSSI au passage en arrière-plan : on ne
    // relance le contrôle (requête réseau) que lorsque l'onglet redevient visible.
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkVerified(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    const u = auth.currentUser;
    if (!u || cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      await sendEmailVerification(u);
      setInfo(`Un nouveau lien de vérification a été envoyé à ${u.email}. Pensez à vérifier vos courriers indésirables.`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(authErrorMessage(e, "Impossible d'envoyer l'e-mail de vérification. Réessayez dans quelques minutes."));
    } finally {
      setResending(false);
    }
  };

  const email = user?.email || auth.currentUser?.email || 'votre adresse';
  const borderStyle = `border ${themeConfig.cardBorder}`;

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center ${themeConfig.bg} ${themeConfig.fontFamily} px-4 py-20 sm:py-16 md:p-8 transition-all duration-300 relative overflow-hidden`}>
      {/* Décor : halos discrets */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-azur/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 bg-azur/10 rounded-full blur-3xl" />

      <ThemeToggle className="absolute top-4 right-4 sm:top-6 sm:right-6 shadow-3xs" />

      <div className="w-full max-w-md relative">
        {/* En-tête */}
        <div className="mb-8 text-center flex flex-col items-center">
          <LogoASF className="w-16 h-16 mb-4 hover:scale-105 transition-transform duration-200" variant="color" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-deep dark:text-azur-pastel font-display">
            Aviation Sans Frontières
          </h1>
        </div>

        {/* Carte */}
        <div className={`w-full p-6 sm:p-10 ${themeConfig.cardBg} ${borderStyle} rounded-2xl ${themeConfig.accentGlow} transition-all duration-300`}>
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-azur/10 text-azur flex items-center justify-center mb-4">
              <MailCheck className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-deep dark:text-azur-pastel font-display">
              Vérifiez votre adresse e-mail
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Pour protéger les documents sensibles des vols, l'accès au portail n'est ouvert
              qu'après confirmation de votre adresse. Un lien de vérification a été envoyé à&nbsp;:
            </p>
            <p className="text-sm font-bold text-deep dark:text-white mt-2 break-all">{email}</p>
          </div>

          {/* Étapes */}
          <ol className="mb-6 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
              <span>Ouvrez l'e-mail d'Aviation Sans Frontières (pensez aux courriers indésirables / spam).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
              <span>Cliquez sur le lien de confirmation qu'il contient.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black shrink-0">3</span>
              <span>Revenez sur cet onglet&nbsp;: votre espace s'ouvrira automatiquement.</span>
            </li>
          </ol>

          {error && (
            <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              <span>{info}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => checkVerified(false)}
            disabled={checking}
            className="btn-asf w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {checking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> J'ai confirmé mon adresse
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="btn-secondary w-full flex items-center justify-center gap-2 mt-3 text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {resending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : cooldown > 0 ? (
              `Renvoyer le lien dans ${cooldown}s`
            ) : (
              <>
                <Send className="w-4 h-4" /> Renvoyer l'e-mail de vérification
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-azur transition-colors cursor-pointer mt-6"
          >
            <LogOut className="w-3.5 h-3.5" /> Mauvaise adresse ? Changer de compte
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Cette étape protège l'accès aux données confidentielles
        </p>
      </div>
    </div>
  );
}
