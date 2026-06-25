import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, Clock, Users, Upload, ClipboardCheck, PlaneTakeoff, CheckCircle2,
  Heart, Compass, Sparkles, Package, GraduationCap, KeyRound, ScrollText, Lock,
  ArrowRight, ChevronRight, Mail, FileText,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { StatusBadge, ThemeToggle } from './ui';
import { openLegal } from './LegalModal';
import type { SubmissionStatus } from '../types';

interface LandingPageProps {
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
}

// Logo SVG conforme à la charte graphique (mains entrelacées formant des ailes)
export function LogoASF({ className = 'w-16 h-16', variant = 'color' }: { className?: string; variant?: 'color' | 'white' }) {
  const { mode } = useTheme();
  const azur = '#1b98c4';
  const azurPastel = '#83d0f5';
  const white = '#ffffff';

  // En mode sombre, même le variant « color » bascule sur le logo blanc pour
  // rester lisible : le logo s'adapte donc automatiquement au thème.
  const useWhite = variant === 'white' || mode === 'dark';
  const mainColor = useWhite ? white : azur;
  const pastelColor = useWhite ? white : azurPastel;

  // Logo officiel (image fournie). On l'affiche en priorité ; si le fichier
  // n'est pas encore présent dans le dépôt, on retombe sur le logo vectoriel
  // intégré ci-dessous (aucune image cassée). Le logo clair (« clear ») est
  // une version nette destinée aux fonds clairs.
  const [imgFailed, setImgFailed] = useState(false);
  const src = useWhite ? '/logo-asf-white.png' : '/logo-asf-clear.png';
  if (!imgFailed) {
    return (
      <img
        src={src}
        alt="Aviation Sans Frontières France"
        className={`${className} object-contain select-none`}
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} id="asf-graphic-logo">
      <g>
        <path d="M32 35C35 45 42 55 52 62C55 64 57 66 59 66C60 66 61 65 61 64C58 58 52 46 48 38C47 36 45 35 43 35C41 35 39 36 38 38L32 35Z" fill={pastelColor} />
        <path d="M24 45C28 55 37 66 49 73C52 75 54 77 56 77C57 77 58 76 58 75C54 68 47 54 42 45C40 42 38 41 36 41C34 41 31 43 30 45L24 45Z" fill={mainColor} />
        <path d="M18 55C23 65 33 77 46 84C49 86 51 88 53 88C54 88 55 87 55 85C50 78 42 63 36 53C34 50 31 49 29 49C26 49 23 51 22 53L18 55Z" fill={pastelColor} />
        <path d="M44 86C52 90 60 92 68 92C78 92 88 88 95 82C98 79 101 76 101 74C101 73 99 72 98 73C90 77 78 81 68 81C58 81 48 77 41 73C40 72 38 73 38 74C38 76 41 79 44 86Z" fill={mainColor} />
        <path d="M88 35C85 45 78 55 68 62C65 64 63 66 61 66C60 66 59 65 59 64C62 58 68 46 72 38C73 36 75 35 77 35C79 35 81 36 82 38L88 35Z" fill={pastelColor} />
        <path d="M96 45C92 55 83 66 71 73C68 75 66 77 64 77C63 77 62 76 62 75C66 68 73 54 78 45C80 42 82 41 84 41C86 41 89 43 90 45L96 45Z" fill={mainColor} />
        <path d="M102 55C97 65 87 77 74 84C71 86 69 88 67 88C66 88 65 87 65 85C70 78 78 63 84 53C86 50 89 49 91 49C94 49 97 51 98 53L102 55Z" fill={pastelColor} />
      </g>
    </svg>
  );
}

/** Compteur animé : anime un nombre au montage (se stabilise toujours sur `to`). */
function CountUp({ to, suffix = '', duration = 1400, startDelay = 250 }: { to: number; suffix?: string; duration?: number; startDelay?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const begin = (t0: number) => {
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(to * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(begin); }, startDelay);
    const settle = setTimeout(() => setVal(to), startDelay + duration + 120);
    return () => { clearTimeout(timer); clearTimeout(settle); cancelAnimationFrame(raf); };
  }, [to, duration, startDelay]);
  return <span>{val.toLocaleString('fr-FR')}{suffix}</span>;
}

// Révélation au défilement (réutilisable).
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const },
};

const EYEBROW = 'inline-block font-mono text-[11px] font-bold tracking-widest uppercase text-azur';

function SectionHead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12 md:mb-14 space-y-3">
      {eyebrow && <motion.span {...reveal} className={EYEBROW}>{eyebrow}</motion.span>}
      <motion.h2 {...reveal} className="text-2xl md:text-4xl font-black font-display tracking-tight text-deep dark:text-azur-pastel">
        {title}
      </motion.h2>
      {sub && (
        <motion.p {...reveal} className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
          {sub}
        </motion.p>
      )}
    </div>
  );
}

/** Aperçu du portail (mockup produit dans le hero). */
function PortalPreview() {
  const rows: { name: string; meta: string; status: SubmissionStatus }[] = [
    { name: 'Récépissé préfectoral', meta: 'PDF · 2,4 Mo', status: 'Validated' },
    { name: "Attestation d'assurance", meta: 'PDF · 1,1 Mo', status: 'Validated' },
    { name: 'Licence de pilote', meta: 'En attente de dépôt', status: 'Pending' },
    { name: 'Fiche bénéficiaire', meta: 'Champ manquant', status: 'Incomplete' },
  ];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-asf-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        <span className="ml-2 font-mono text-[11px] text-slate-400 dark:text-slate-500">portail.asf-sud-est.org</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className={EYEBROW} style={{ fontSize: 10 }}>Dossier de vol</span>
            <h3 className="mt-0.5 text-base font-extrabold text-deep dark:text-azur-pastel font-display">Baptême de l'air — Antenne 06</h3>
          </div>
          <span className="font-mono text-[11px] font-bold text-azur">3 / 4</span>
        </div>
        <div className="h-[7px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden my-3">
          <div className="asf-bar h-full rounded-full bg-gradient-to-r from-azur to-deep" style={{ width: '75%' }} />
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="w-8 h-8 rounded-lg bg-azur-light dark:bg-azur/15 text-azur flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div className="grow min-w-0">
                <div className="text-[0.82rem] font-semibold text-slate-800 dark:text-slate-100 truncate">{r.name}</div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{r.meta}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onNavigateLogin, onNavigateRegister }: LandingPageProps) {
  useTheme();

  const NAV = [
    { label: 'Le portail', href: '#etapes' },
    { label: 'Suivi des dossiers', href: '#suivi' },
    { label: 'Les Ailes du Sourire', href: '#sourire' },
    { label: 'Nos missions', href: '#missions' },
    { label: 'Sécurité', href: '#securite' },
  ];

  const proof = [
    { icon: ShieldCheck, t: 'Hébergement sécurisé' },
    { icon: Clock, t: 'Statuts en temps réel' },
    { icon: Users, t: 'Validation par antenne' },
  ];

  const stats = [
    { to: 800, suffix: '+', l: 'Bénévoles engagés' },
    { to: 45, suffix: ' ans', l: "Au service de l'humanitaire" },
    { to: 20, suffix: '+', l: 'Missions par jour' },
    { to: 6, suffix: '', l: "Domaines d'action" },
  ];

  const steps = [
    { n: '01', icon: Upload, title: 'Déposez vos documents', desc: 'Créez votre espace partenaire et transmettez vos justificatifs réglementaires en toute sécurité.' },
    { n: '02', icon: ClipboardCheck, title: 'Suivez la validation', desc: 'Chaque pièce est revue par votre antenne. Statuts en temps réel à chaque étape du dossier.' },
    { n: '03', icon: PlaneTakeoff, title: 'Envolez-vous', desc: "Dossier validé : le vol Les Ailes du Sourire est autorisé. Place à l'évasion et aux sourires." },
  ];

  const flow: { status: SubmissionStatus; desc: string }[] = [
    { status: 'Pending', desc: "La pièce est attendue ou vient d'être déposée par le partenaire." },
    { status: 'Validated', desc: "La pièce est conforme : elle compte pour l'autorisation de vol." },
    { status: 'Incomplete', desc: 'Un élément manque ou doit être corrigé avant nouvelle revue.' },
  ];

  const bullets = [
    { t: 'Vols de découverte aérienne', d: "Un parcours d'évasion aux côtés d'un pilote chevronné, au-dessus des plus belles régions." },
    { t: 'Coordination réglementaire', d: "Chaque vol suit un protocole d'autorisation, orchestré via ce portail numérique." },
    { t: "Réseau d'aéroclubs & partenaires", d: 'Nous relions établissements de santé, aéroclubs hôtes et accompagnants.' },
  ];

  const missions = [
    { title: 'Missions Avions', subtitle: 'Avion-Hôpital & Drone Humanitaire', desc: "Transport de médecins, de médicaments et d'aide urgente au plus près des populations isolées.", icon: Compass },
    { title: "Accompagnements d'Enfants Malades", subtitle: "Soins d'urgence à l'étranger", desc: "Prise en charge d'enfants malades transférés pour être opérés en Europe.", icon: Heart },
    { title: 'Messagerie Médicale & Fret', subtitle: 'Logistique solidaire', desc: 'Expédition facilitée de colis de secours, vaccins et matériel médical partout dans le monde.', icon: Package },
    { title: 'Accompagnements de Réfugiés', subtitle: 'Vers de nouveaux horizons', desc: 'Assistance et accueil des réfugiés lors de leurs voyages de réinstallation officiels.', icon: Users },
    { title: 'Les Ailes du Sourire', subtitle: "L'envol thérapeutique", desc: "Vols de découverte et d'initiation pour les personnes en situation de handicap ou d'exclusion sociale.", icon: Heart, highlight: true },
    { title: "Les Ailes de l'Avenir", subtitle: 'Insertion des jeunes', desc: "Ateliers de découverte des métiers de l'aérien pour favoriser l'insertion de jeunes en difficulté.", icon: GraduationCap },
  ];

  const security = [
    { icon: ShieldCheck, t: 'Hébergement sécurisé', d: "Infrastructure Firebase chiffrée, conforme au RGPD, hébergée dans l'Union européenne." },
    { icon: KeyRound, t: 'Accès par rôle', d: 'Partenaires, antennes et administrateurs : chacun ne voit que ce qui le concerne.' },
    { icon: ScrollText, t: 'Traçabilité complète', d: "Chaque dépôt, revue et validation est horodaté et journalisé dans un registre d'audit." },
    { icon: Lock, t: 'Documents protégés', d: 'Les pièces réglementaires restent confidentielles et ne quittent jamais le portail.' },
  ];

  return (
    <div className="min-h-screen relative flex flex-col bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-x-hidden antialiased font-sans">

      {/* Bandeau d'annonce */}
      <div className="bg-deep text-white py-2 px-4 text-center text-[11px] font-medium tracking-wide">
        Portail documentaire officiel — <span className="font-semibold">Aviation Sans Frontières · Les Ailes du Sourire</span>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6 px-4 sm:px-7 py-2.5">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo-asf-clear.png" alt="Aviation Sans Frontières France" className="h-9 sm:h-11 w-auto object-contain select-none dark:hidden" draggable={false} />
            <img src="/logo-asf-white.png" alt="Aviation Sans Frontières France" className="h-9 sm:h-11 w-auto object-contain select-none hidden dark:block" draggable={false} />
          </a>
          <nav className="hidden lg:flex items-center gap-7">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-[0.82rem] font-semibold text-slate-600 dark:text-slate-300 hover:text-azur dark:hover:text-azur-pastel transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button onClick={onNavigateLogin} id="cta-top-login" className="btn-ghost text-xs cursor-pointer">Se connecter</button>
            <button onClick={onNavigateRegister} id="cta-top-register" className="btn-sourire text-xs !py-2 !px-4 cursor-pointer">Créer un compte</button>
          </div>
        </div>
      </header>

      <main className="grow">

        {/* ===================== HERO ===================== */}
        <section id="top" className="relative overflow-hidden bg-gradient-to-b from-azur-light to-white dark:from-slate-900 dark:to-slate-950">
          <div className="absolute -top-28 -left-24 w-[26rem] h-[26rem] bg-azur/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-7xl mx-auto px-5 sm:px-6 py-12 sm:py-14 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">

            {/* Colonne texte */}
            <div className="lg:col-span-6 flex flex-col items-start text-left gap-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-deep dark:text-azur-pastel bg-white dark:bg-slate-800 border border-azur/25 dark:border-azur/30 shadow-asf-sm tracking-widest uppercase font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Portail documentaire officiel
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}
                className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight text-deep dark:text-white font-display leading-[1.05]"
              >
                Le portail des dossiers de vol d'
                <span className="bg-gradient-to-r from-azur to-deep dark:from-azur-pastel dark:to-azur bg-clip-text text-transparent">Aviation Sans Frontières</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}
                className="text-slate-600 dark:text-slate-300 text-sm md:text-lg leading-relaxed max-w-xl"
              >
                Déposez, suivez et faites valider les documents réglementaires nécessaires aux vols
                <span className="font-semibold text-deep dark:text-azur-pastel"> Les Ailes du Sourire</span>. Un espace unique,
                clair et sécurisé, partagé entre partenaires, antennes et chefs de mission.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.25 }}
                className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
              >
                <button onClick={onNavigateRegister} id="cta-hero-register" className="btn-sourire text-sm cursor-pointer group">
                  Créer un compte partenaire
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={onNavigateLogin} id="cta-hero-login" className="btn-asf text-sm cursor-pointer">
                  Accéder à mon espace
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.35 }}
                className="flex flex-wrap gap-x-6 gap-y-2.5 pt-1"
              >
                {proof.map((p) => (
                  <span key={p.t} className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">
                    <p.icon className="w-4 h-4 text-azur" /> {p.t}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Colonne aperçu produit */}
            <motion.div
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-6 relative"
            >
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-azur/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-azur-pastel/20 rounded-full blur-2xl pointer-events-none" />
              <PortalPreview />
            </motion.div>
          </div>
        </section>

        {/* ===================== CHIFFRES ===================== */}
        <section className="px-6 py-16 bg-gradient-to-b from-white via-azur-light to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                className={`text-center ${i ? 'md:border-l border-azur/15' : ''}`}
              >
                <div className="text-3xl md:text-[2.75rem] font-black font-display leading-none text-azur">
                  <CountUp to={s.to} suffix={s.suffix} />
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-widest font-bold font-mono text-slate-500 dark:text-slate-400">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===================== COMMENT ÇA MARCHE ===================== */}
        <section id="etapes" className="px-6 py-20 md:py-22 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto">
            <SectionHead eyebrow="Le portail en 3 étapes" title="Un circuit clair, du dépôt à l'autorisation" />
            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                  className="relative card-asf p-7 hover:-translate-y-1.5 hover:shadow-asf-md transition-all"
                >
                  <span className="absolute top-5 right-6 text-5xl font-black text-azur/10 font-display select-none leading-none">{s.n}</span>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-azur to-deep text-white flex items-center justify-center shadow-asf-md mb-4">
                    <s.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-deep dark:text-azur-pastel">{s.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== SUIVI DES DOSSIERS ===================== */}
        <section id="suivi" className="px-6 py-20 md:py-22 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto">
            <SectionHead
              eyebrow="Transparence"
              title="Le suivi des dossiers, en temps réel"
              sub="Trois statuts, partagés entre le partenaire et son antenne, donnent à chacun une vision claire de l'avancement de chaque pièce."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {flow.map((f, i) => (
                <motion.div
                  key={f.status}
                  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                  className="card-asf p-5 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                    <StatusBadge status={f.status} />
                  </div>
                  <p className="text-[0.8rem] leading-relaxed text-slate-600 dark:text-slate-300">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== AILES DU SOURIRE ===================== */}
        <section id="sourire" className="px-6 py-20 md:py-22 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 lg:gap-14 items-center">
            <motion.div {...reveal} className="space-y-5">
              <span className={EYEBROW}>Focus solidaire</span>
              <h2 className="text-2xl md:text-4xl font-black font-display tracking-tight text-deep dark:text-azur-pastel leading-tight">
                Les Ailes du Sourire :<br />l'évasion pour tous
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
                Dans le respect strict des chartes de sécurité, nos délégations s'organisent avec des aéroclubs
                partenaires pour offrir aux personnes en situation de handicap ou de précarité des journées
                d'initiation aéronautique et un baptême de l'air inoubliable.
              </p>
              <div className="space-y-3">
                {bullets.map((b) => (
                  <div key={b.t} className="flex items-start gap-3 bg-white dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-asf-sm">
                    <CheckCircle2 className="w-[18px] h-[18px] text-azur shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-deep dark:text-azur-pastel">{b.t}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{b.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onNavigateLogin} id="cta-ailes-sourire" className="btn-asf text-sm cursor-pointer group">
                Consulter les dossiers de vol
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            <motion.div {...reveal} className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-br from-azur to-deep text-white p-5 h-44 flex flex-col justify-between shadow-asf-md">
                  <Heart className="w-7 h-7 fill-white/90 text-white/90" />
                  <p className="text-xs italic leading-relaxed">« Un enfant qui décolle, c'est son handicap qui reste à terre le temps d'un vol. »</p>
                  <span className="text-[9px] font-mono font-bold opacity-80">— Pilote bénévole</span>
                </div>
                <div className="card-asf p-5 h-32 flex flex-col justify-center">
                  <span className="text-3xl font-black text-azur leading-none">96%</span>
                  <h4 className="text-sm font-bold text-deep dark:text-azur-pastel mt-1.5">Sourires & évasion</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Un impact thérapeutique prouvé.</p>
                </div>
              </div>
              <div className="space-y-4 pt-7">
                <div className="card-asf p-5 h-32 flex flex-col justify-center">
                  <Compass className="w-7 h-7 text-azur" />
                  <h4 className="text-sm font-bold text-deep dark:text-azur-pastel mt-2.5">Pilotes certifiés</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Encadrement et sécurité avant tout.</p>
                </div>
                <div className="card-asf p-5 h-44 flex flex-col justify-between">
                  <Sparkles className="w-7 h-7 text-sourire" />
                  <div>
                    <h4 className="text-sm font-bold text-deep dark:text-azur-pastel">Une journée, un souvenir</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">Accueil, briefing, baptême de l'air et remise de diplôme : un parcours complet pensé pour chaque bénéficiaire.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ===================== MISSIONS ===================== */}
        <section id="missions" className="px-6 py-20 md:py-22 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <SectionHead
              title="Nos domaines d'action"
              sub="Aviation Sans Frontières intervient sur un large panel d'activités humanitaires et d'intégration, en France et dans le monde."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {missions.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.45, delay: (index % 3) * 0.08, ease: [0.4, 0, 0.2, 1] }}
                  className={`group relative overflow-hidden p-6 rounded-2xl bg-white dark:bg-slate-900 border shadow-asf-sm hover:-translate-y-1.5 hover:shadow-asf-md transition-all ${item.highlight ? 'border-azur/40 ring-1 ring-azur/30' : 'border-slate-200 dark:border-slate-800'}`}
                >
                  {item.highlight && (
                    <span className="absolute top-4 right-4 bg-azur text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-mono">
                      Mission phare
                    </span>
                  )}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${item.highlight ? 'bg-gradient-to-br from-azur to-deep text-white' : 'bg-azur/10 dark:bg-azur/15 text-azur'}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] tracking-widest uppercase font-black text-slate-400 dark:text-slate-500 block font-mono">{item.subtitle}</span>
                  <h3 className="text-base font-bold text-deep dark:text-azur-pastel font-display mt-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{item.desc}</p>
                  <button onClick={onNavigateLogin} className="mt-4 text-[11px] font-bold text-azur inline-flex items-center gap-1 group-hover:gap-2 transition-all cursor-pointer font-display">
                    Voir les dossiers liés <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== SÉCURITÉ ===================== */}
        <section id="securite" className="px-6 py-20 md:py-22 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto">
            <SectionHead
              eyebrow="Sécurité & conformité"
              title="Vos documents réglementaires, en confiance"
              sub="Le portail a été conçu pour protéger des données sensibles : justificatifs, identités et autorisations de vol."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {security.map((it, i) => (
                <motion.div
                  key={it.t}
                  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className="w-[42px] h-[42px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-azur flex items-center justify-center mb-3.5 shadow-asf-sm">
                    <it.icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-[0.92rem] font-bold text-deep dark:text-azur-pastel font-display mb-1.5">{it.t}</h4>
                  <p className="text-[0.78rem] text-slate-500 dark:text-slate-400 leading-relaxed">{it.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== CTA FINAL ===================== */}
        <section className="px-6 pt-26 pb-24 relative overflow-hidden text-white bg-gradient-to-b from-white via-azur to-deep-dark dark:from-slate-950">
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -left-16 -bottom-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <motion.div {...reveal} className="max-w-3xl mx-auto text-center space-y-5 relative z-10 flex flex-col items-center">
            <div className="asf-float">
              <img src="/logo-asf-white.png" alt="Aviation Sans Frontières France" className="h-[76px] w-auto object-contain" draggable={false} />
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight font-display">Prêt à faire décoller vos dossiers ?</h2>
            <p className="text-sm md:text-base text-azur-pastel max-w-xl mx-auto leading-relaxed">
              Connectez-vous pour compléter votre fiche, déposer vos récépissés réglementaires et collaborer avec nos chefs de mission.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1 w-full sm:w-auto justify-center">
              <button onClick={onNavigateLogin} id="cta-bottom-login-btn" className="px-8 py-3.5 bg-white hover:bg-slate-50 text-azur font-black text-sm rounded-xl tracking-wide shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer font-display">
                Accéder à mon espace
              </button>
              <button onClick={onNavigateRegister} id="cta-bottom-register-btn" className="px-6 py-3.5 bg-transparent hover:bg-white/10 text-white font-extrabold text-sm rounded-xl border border-white/40 transition-all cursor-pointer font-display">
                Créer un compte
              </button>
            </div>
          </motion.div>
        </section>

      </main>

      {/* Footer enrichi */}
      <footer className="bg-slate-950 text-slate-300 shrink-0">
        <div className="max-w-7xl mx-auto px-6 pt-14 pb-7 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <img src="/logo-asf-white.png" alt="Aviation Sans Frontières France" className="h-[54px] w-auto object-contain" draggable={false} />
            <p className="mt-4 text-[12.5px] leading-relaxed text-slate-400 max-w-[280px]">
              La première ONG aéronautique d'utilité publique en France. Portail documentaire officiel des vols Les Ailes du Sourire.
            </p>
          </div>
          {[
            { h: 'Le portail', links: ['Comment ça marche', 'Suivi des dossiers', 'Sécurité & conformité', 'Se connecter'] },
            { h: 'Nos missions', links: ['Les Ailes du Sourire', 'Missions Avions', 'Enfants malades', "Les Ailes de l'Avenir"] },
            { h: 'Ressources', links: ['Charte de sécurité', 'Mentions légales', 'Protection des données', 'Nous contacter'] },
          ].map((c) => (
            <div key={c.h}>
              <h4 className="mb-3.5 text-[11px] uppercase tracking-widest font-bold text-white font-mono">{c.h}</h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => {
                  const cls = 'text-[13px] text-slate-400 hover:text-azur-pastel transition-colors cursor-pointer text-left';
                  let node: React.ReactNode;
                  if (l === 'Mentions légales') node = <button type="button" onClick={() => openLegal('legal')} className={cls}>{l}</button>;
                  else if (l === 'Protection des données' || l === 'Sécurité & conformité' || l === 'Charte de sécurité') node = <button type="button" onClick={() => openLegal('privacy')} className={cls}>{l}</button>;
                  else if (l === 'Se connecter') node = <button type="button" onClick={onNavigateLogin} className={cls}>{l}</button>;
                  else if (l === 'Nous contacter') node = <a href="mailto:communication@aviation-sans-frontieres-fr.org" className={cls}>{l}</a>;
                  else node = <a href="#top" className={cls}>{l}</a>;
                  return <li key={l}>{node}</li>;
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-4.5 flex flex-wrap justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[11px] text-slate-500">© Aviation Sans Frontières · Tous droits réservés.</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400/90">
                <ShieldCheck className="w-3.5 h-3.5" /> Conforme RGPD · données hébergées dans l'UE
              </span>
              <button type="button" onClick={() => openLegal('privacy')} className="text-[11px] text-slate-400 hover:text-azur-pastel transition-colors cursor-pointer">
                Politique de confidentialité
              </button>
              <button type="button" onClick={() => openLegal('legal')} className="text-[11px] text-slate-400 hover:text-azur-pastel transition-colors cursor-pointer">
                Mentions légales
              </button>
            </div>
            <a href="mailto:communication@aviation-sans-frontieres-fr.org" id="footer-email-link" className="text-azur-pastel hover:underline inline-flex items-center gap-1.5 font-mono text-xs">
              <Mail className="w-3.5 h-3.5" /> communication@aviation-sans-frontieres-fr.org
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
