import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Compass, Calendar, CheckCircle2, ChevronRight, Users, Heart, ClipboardCheck, ArrowRight, Menu, X, Mail, Upload } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import CessnaPlane from './CessnaPlane';

interface LandingPageProps {
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
}

// Logo SVG conforme à la charte graphique (mains entrelacées formant des ailes)
export function LogoASF({ className = "w-16 h-16", variant = "color" }: { className?: string; variant?: "color" | "white" }) {
  const azur = "#1b98c4";
  const azurPastel = "#83d0f5";
  const white = "#ffffff";

  const mainColor = variant === "color" ? azur : white;
  const pastelColor = variant === "color" ? azurPastel : white;

  // Logo officiel (image fournie). On l'affiche en priorité ; si le fichier
  // n'est pas encore présent dans le dépôt, on retombe sur le logo vectoriel
  // intégré ci-dessous (aucune image cassée).
  //   - variant "color" → /logo-asf.png       (fonds clairs)
  //   - variant "white" → /logo-asf-white.png  (fonds foncés)
  const [imgFailed, setImgFailed] = useState(false);
  const src = variant === "white" ? "/logo-asf-white.png" : "/logo-asf.png";
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
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      id="asf-graphic-logo"
    >
      {/* Mains entrelacées formant des ailes */}
      <g>
        {/* Aile Gauche / Main gauche */}
        <path
          d="M32 35C35 45 42 55 52 62C55 64 57 66 59 66C60 66 61 65 61 64C58 58 52 46 48 38C47 36 45 35 43 35C41 35 39 36 38 38L32 35Z"
          fill={pastelColor}
        />
        <path
          d="M24 45C28 55 37 66 49 73C52 75 54 77 56 77C57 77 58 76 58 75C54 68 47 54 42 45C40 42 38 41 36 41C34 41 31 43 30 45L24 45Z"
          fill={mainColor}
        />
        <path
          d="M18 55C23 65 33 77 46 84C49 86 51 88 53 88C54 88 55 87 55 85C50 78 42 63 36 53C34 50 31 49 29 49C26 49 23 51 22 53L18 55Z"
          fill={pastelColor}
        />
        <path
          d="M44 86C52 90 60 92 68 92C78 92 88 88 95 82C98 79 101 76 101 74C101 73 99 72 98 73C90 77 78 81 68 81C58 81 48 77 41 73C40 72 38 73 38 74C38 76 41 79 44 86Z"
          fill={mainColor}
        />

        {/* Aile Droite / Main droite */}
        <path
          d="M88 35C85 45 78 55 68 62C65 64 63 66 61 66C60 66 59 65 59 64C62 58 68 46 72 38C73 36 75 35 77 35C79 35 81 36 82 38L88 35Z"
          fill={pastelColor}
        />
        <path
          d="M96 45C92 55 83 66 71 73C68 75 66 77 64 77C63 77 62 76 62 75C66 68 73 54 78 45C80 42 82 41 84 41C86 41 89 43 90 45L96 45Z"
          fill={mainColor}
        />
        <path
          d="M102 55C97 65 87 77 74 84C71 86 69 88 67 88C66 88 65 87 65 85C70 78 78 63 84 53C86 50 89 49 91 49C94 49 97 51 98 53L102 55Z"
          fill={pastelColor}
        />
      </g>
    </svg>
  );
}

/** Petit nuage cotonneux (décor de la scène aérienne). */
function Cloud({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative">
        <div className="w-20 h-6 bg-white/85 rounded-full" />
        <div className="w-11 h-11 bg-white/85 rounded-full absolute -top-4 left-3" />
        <div className="w-8 h-8 bg-white/85 rounded-full absolute -top-2 left-11" />
      </div>
    </div>
  );
}

// Révélation au défilement (réutilisable).
const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const },
};

export default function LandingPage({ onNavigateLogin, onNavigateRegister }: LandingPageProps) {
  useTheme();

  const steps = [
    { n: "01", icon: Upload, title: "Déposez vos documents", desc: "Créez votre espace partenaire et transmettez vos justificatifs réglementaires en quelques clics, en toute sécurité." },
    { n: "02", icon: ClipboardCheck, title: "Suivez la validation", desc: "Chaque pièce est revue par votre antenne. Statuts en temps réel : en attente, en révision, validé." },
    { n: "03", icon: CheckCircle2, title: "Envolez-vous", desc: "Dossiers validés : les vols Les Ailes du Sourire sont autorisés. Place à l’évasion et aux sourires." },
  ];

  const officialMissions = [
    { title: "Missions Avions", subtitle: "Avion-Hôpital & Drone Humanitaire", desc: "Transport de médecins, de médicaments et d’aide urgente au plus près des populations isolées.", icon: Compass },
    { title: "Accompagnements d’Enfants Malades", subtitle: "Soins d’urgence à l’étranger", desc: "Prise en charge d’enfants malades transférés pour être opérés en Europe.", icon: Heart },
    { title: "Messagerie Médicale & Fret", subtitle: "Logistique solidaire", desc: "Expédition facilitée de colis de secours, vaccins et matériel médical partout dans le monde.", icon: ClipboardCheck },
    { title: "Accompagnements de Réfugiés", subtitle: "Vers de nouveaux horizons", desc: "Assistance et accueil des réfugiés lors de leurs voyages de réinstallation officiels.", icon: Users },
    { title: "Les Ailes du Sourire", subtitle: "L’envol thérapeutique", desc: "Vols de découverte et d’initiation pour les personnes en situation de handicap ou d’exclusion sociale.", icon: Heart, highlight: true },
    { title: "Les Ailes de l’Avenir", subtitle: "Insertion des jeunes", desc: "Ateliers de découverte des métiers de l’aérien pour favoriser l’insertion de jeunes en difficulté.", icon: Calendar },
  ];

  return (
    <div className="min-h-screen relative flex flex-col bg-white text-slate-800 overflow-x-hidden antialiased font-sans">

      {/* Bandeau d'annonce */}
      <div className="bg-deep text-white py-2 px-4 text-center text-[11px] font-medium tracking-wide">
        Portail documentaire officiel — <span className="font-semibold">Aviation Sans Frontières · Les Ailes du Sourire</span>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-6 py-2.5">
          <img
            src="/logo-asf.png"
            alt="Aviation Sans Frontières France"
            className="h-11 sm:h-12 w-auto object-contain select-none"
            draggable={false}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateLogin}
              id="cta-top-login"
              className="text-xs font-bold text-slate-600 hover:text-azur px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Se connecter
            </button>
            <button
              onClick={onNavigateRegister}
              id="cta-top-register"
              className="btn-sourire text-xs !py-2 !px-4 cursor-pointer"
            >
              Créer un compte
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">

        {/* ===================== HERO ===================== */}
        <section className="relative overflow-hidden">
          {/* Fond ciel */}
          <div className="absolute inset-0 bg-gradient-to-b from-azur-light via-white to-white" />
          <div className="absolute -top-28 -left-24 w-[28rem] h-[28rem] bg-azur/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-8 -right-10 w-[26rem] h-[26rem] bg-azur-pastel/25 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-6 py-14 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">

            {/* Colonne texte */}
            <div className="lg:col-span-6 flex flex-col items-start text-left space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold text-deep bg-white/80 backdrop-blur border border-azur/25 shadow-asf-sm tracking-widest uppercase"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Portail documentaire · Les Ailes du Sourire
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05 }}
                className="text-4xl md:text-6xl font-black tracking-tight text-deep font-display leading-[1.05]"
              >
                Donnez des ailes
                <br />
                <span className="bg-gradient-to-r from-azur to-deep bg-clip-text text-transparent">à vos dossiers de vol</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.15 }}
                className="text-slate-600 text-sm md:text-lg leading-relaxed max-w-xl"
              >
                Déposez, suivez et faites valider en quelques clics les documents nécessaires aux vols
                <span className="font-semibold text-deep"> Les Ailes du Sourire</span> d’Aviation Sans Frontières.
                Un espace clair et sécurisé, au service de chaque sourire qui s’envole.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.25 }}
                className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
              >
                <button onClick={onNavigateRegister} id="cta-hero-register" className="btn-sourire text-sm cursor-pointer group">
                  Créer mon compte
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={onNavigateLogin} id="cta-hero-login" className="btn-asf text-sm cursor-pointer">
                  Accéder à mon espace
                </button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="text-xs font-medium text-slate-500 flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-azur" />
                Le dépôt de documents nécessite un compte partenaire validé.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200/80 w-full max-w-md"
              >
                {[
                  { v: "800+", l: "Bénévoles" },
                  { v: "45 ans", l: "Au service" },
                  { v: "20+", l: "Missions / jour" },
                ].map((s) => (
                  <div key={s.l}>
                    <span className="block text-xl md:text-2xl font-black text-azur">{s.v}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">{s.l}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Colonne scène 3D animée (Cessna) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7 }}
              className="lg:col-span-6 relative"
            >
              <div
                className="relative h-[340px] md:h-[460px] rounded-[2rem] overflow-hidden border border-white/50 shadow-asf-lg bg-gradient-to-b from-[#dbf1fc] via-[#8ccdec] to-[#2f9fc9]"
                style={{ perspective: "1200px" }}
              >
                {/* Soleil */}
                <div className="absolute top-6 right-8 w-36 h-36 rounded-full bg-white/30 blur-2xl pointer-events-none" />
                <div className="absolute top-8 right-10 w-24 h-24 rounded-full bg-amber-50/90 pointer-events-none" />

                {/* Scène en perspective 3D */}
                <div className="asf-scene-3d absolute inset-0">
                  {/* Nuages lointains (profondeur arrière) */}
                  <div className="absolute inset-0" style={{ transform: "translateZ(-60px)" }}>
                    <Cloud className="asf-cloud-slow absolute top-10 left-6 scale-90 opacity-80" />
                    <Cloud className="asf-cloud-fast absolute top-36 right-8 scale-75 opacity-70" />
                  </div>

                  {/* Trajectoire de vol */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M-5 70 Q 28 44 55 52 T 108 24" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.5" strokeDasharray="2.5 2.5" fill="none" />
                  </svg>

                  {/* Cessna principal (profondeur avant) */}
                  <div className="absolute top-[38%] left-0 right-0" style={{ transform: "translateZ(70px)" }}>
                    <div className="asf-plane-cross w-32 md:w-48">
                      <div className="asf-bob drop-shadow-[0_10px_12px_rgba(10,70,89,0.3)]">
                        <CessnaPlane variant="color" className="w-full" />
                      </div>
                    </div>
                  </div>

                  {/* Nuages proches (très en avant, flous) */}
                  <div className="absolute inset-0" style={{ transform: "translateZ(120px)" }}>
                    <Cloud className="asf-cloud-fast absolute bottom-20 left-10 scale-110 blur-[1px]" />
                  </div>

                  {/* Badge logo flottant (avant-plan) */}
                  <div className="absolute bottom-5 left-5" style={{ transform: "translateZ(150px)" }}>
                    <div className="asf-float bg-white/90 backdrop-blur rounded-2xl shadow-lg p-2.5 border border-white/70">
                      <img src="/logo-asf.png" alt="ASF" className="h-9 w-auto object-contain" draggable={false} />
                    </div>
                  </div>
                </div>

                {/* Bandeau mission */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-deep-dark/85 via-deep/30 to-transparent p-5 pt-12 text-white text-left pointer-events-none">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[8px] tracking-widest font-bold uppercase bg-azur">Mission</span>
                    <p className="text-[11px] font-mono tracking-wider opacity-90">Les Ailes de l’Humanitaire</p>
                  </div>
                  <h3 className="text-base font-bold font-display">Chaque dossier validé, c’est un vol qui peut décoller.</h3>
                </div>
              </div>

              {/* Halos décoratifs */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-azur/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-azur-pastel/20 rounded-full blur-2xl pointer-events-none" />
            </motion.div>
          </div>
        </section>

        {/* ============== COMMENT ÇA MARCHE ============== */}
        <section className="px-6 py-20 bg-white border-t border-slate-100">
          <div className="max-w-6xl mx-auto">
            <motion.div {...reveal} className="text-center max-w-2xl mx-auto mb-14 space-y-3">
              <span className="inline-block px-3 py-1 rounded-full bg-azur/10 text-azur text-[11px] font-bold tracking-widest uppercase font-mono">
                Simple & sécurisé
              </span>
              <h2 className="text-2xl md:text-4xl font-black font-display tracking-tight text-deep">
                Trois étapes pour faire décoller vos dossiers
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                  className="relative card-asf p-7 hover:-translate-y-1.5 hover:shadow-asf-md"
                >
                  <span className="absolute top-5 right-6 text-5xl font-black text-azur/10 font-display select-none">{s.n}</span>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-azur to-deep text-white flex items-center justify-center shadow-asf-md mb-4">
                    <s.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-deep">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-2">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============== AILES DU SOURIRE ============== */}
        <section className="px-6 py-20 bg-gradient-to-b from-azur-light/60 to-white">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div {...reveal} className="space-y-6">
              <span className="inline-block px-3 py-1 rounded-full bg-azur/15 text-azur text-[11px] font-bold tracking-widest uppercase font-mono">
                Focus solidaire
              </span>
              <h2 className="text-2xl md:text-4xl font-black font-display tracking-tight text-deep leading-tight">
                Les Ailes du Sourire :<br />l’évasion pour tous
              </h2>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                Dans le respect strict des chartes de sécurité, nos délégations s’organisent avec des aéroclubs
                partenaires pour offrir aux personnes en situation de handicap ou de précarité des journées
                d’initiation aéronautique et un baptême de l’air inoubliable.
              </p>

              <div className="space-y-3">
                {[
                  { t: "Vols de découverte aérienne", d: "Un parcours d’évasion aux côtés d’un pilote chevronné, au-dessus des plus belles régions." },
                  { t: "Coordination réglementaire", d: "Chaque vol suit un protocole d’autorisation, orchestré via ce portail numérique." },
                  { t: "Réseau d’aéroclubs & partenaires", d: "Nous relions établissements de santé, aéroclubs hôtes et accompagnants." },
                ].map((b) => (
                  <div key={b.t} className="flex items-start gap-3 bg-white/80 backdrop-blur p-3.5 rounded-xl border border-slate-100 shadow-asf-sm">
                    <CheckCircle2 className="w-4 h-4 text-azur shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-deep">{b.t}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{b.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={onNavigateLogin}
                id="cta-ailes-sourire"
                className="btn-asf text-sm cursor-pointer group"
              >
                Consulter les dossiers de vol
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            <motion.div {...reveal} className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-br from-azur to-deep text-white p-5 h-44 flex flex-col justify-between shadow-asf-md">
                  <Heart className="w-7 h-7 fill-white/90 text-white/90" />
                  <p className="text-xs italic leading-relaxed">« Un enfant qui décolle, c’est son handicap qui reste à terre le temps d’un vol. »</p>
                  <span className="text-[9px] font-mono font-bold opacity-80">— Pilote bénévole</span>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 p-5 h-32 flex flex-col justify-center shadow-asf-sm">
                  <span className="text-3xl font-black text-azur">96%</span>
                  <h4 className="text-xs font-bold text-deep">Sourires & évasion</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">Un impact thérapeutique prouvé.</p>
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="rounded-2xl bg-white border border-slate-100 p-5 h-32 flex flex-col justify-center shadow-asf-sm">
                  <Compass className="w-7 h-7 text-azur" />
                  <h4 className="text-xs font-bold text-deep mt-2">Pilotes certifiés</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">Encadrement et sécurité avant tout.</p>
                </div>
                <div className="rounded-2xl overflow-hidden h-44 relative bg-gradient-to-b from-[#bfe6f7] to-[#2f9fc9] shadow-asf-md">
                  <Cloud className="asf-cloud-slow absolute top-6 left-4 scale-75 opacity-80" />
                  <div className="asf-plane-cross absolute top-1/2 -translate-y-1/2 left-0 w-24">
                    <div className="asf-bob"><CessnaPlane variant="color" className="w-full" /></div>
                  </div>
                  <span className="absolute bottom-3 left-4 text-white text-[10px] font-mono font-bold tracking-wider">En vol ✈</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============== MISSIONS ============== */}
        <section className="px-6 py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto">
            <motion.div {...reveal} className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <h2 className="text-2xl md:text-4xl font-black font-display tracking-tight text-deep">
                Nos domaines d’action
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                Aviation Sans Frontières intervient sur un large panel d’activités humanitaires et d’intégration, en France et dans le monde.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {officialMissions.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.45, delay: (index % 3) * 0.08, ease: [0.4, 0, 0.2, 1] }}
                  className={`group p-6 rounded-2xl bg-white border shadow-asf-sm hover:-translate-y-1.5 hover:shadow-asf-md transition-all relative overflow-hidden ${item.highlight ? "border-azur/40 ring-1 ring-azur/30" : "border-slate-200/80"}`}
                >
                  {item.highlight && (
                    <span className="absolute top-4 right-4 bg-azur text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                      Mission phare
                    </span>
                  )}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${item.highlight ? "bg-gradient-to-br from-azur to-deep text-white" : "bg-azur/10 text-azur"}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] tracking-wider uppercase font-black text-slate-400 block font-mono">{item.subtitle}</span>
                  <h3 className="text-base font-bold text-deep font-display mt-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">{item.desc}</p>
                  <button
                    onClick={onNavigateLogin}
                    className="mt-4 text-[11px] font-bold text-azur inline-flex items-center gap-1 group-hover:gap-2 transition-all cursor-pointer"
                  >
                    Voir les dossiers liés <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============== CTA FINAL (3D) ============== */}
        <section className="px-6 py-24 relative overflow-hidden bg-gradient-to-br from-deep via-azur to-deep-dark text-white">
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -left-16 -bottom-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          {/* Cessna qui traverse */}
          <div className="asf-plane-cross absolute top-10 left-0 w-28 opacity-80 pointer-events-none">
            <CessnaPlane variant="white" className="w-full" />
          </div>
          <div className="asf-plane-cross-slow absolute bottom-12 left-0 w-16 opacity-40 pointer-events-none">
            <CessnaPlane variant="white" className="w-full" spin={false} />
          </div>

          <motion.div {...reveal} className="max-w-3xl mx-auto text-center space-y-6 relative z-10 flex flex-col items-center">
            <div className="asf-float bg-white/95 rounded-3xl p-4 shadow-asf-lg">
              <img src="/logo-asf.png" alt="Aviation Sans Frontières France" className="h-16 w-auto object-contain" draggable={false} />
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight font-display">
              Prêt à faire décoller vos dossiers ?
            </h2>
            <p className="text-sm md:text-base text-azur-pastel max-w-xl mx-auto leading-relaxed">
              Connectez-vous pour compléter votre fiche, déposer vos récépissés réglementaires et collaborer avec nos chefs de mission.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full sm:w-auto justify-center">
              <button
                onClick={onNavigateLogin}
                id="cta-bottom-login-btn"
                className="px-8 py-3.5 bg-white hover:bg-slate-50 text-azur font-black text-sm rounded-xl tracking-wide shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                Accéder à mon espace
              </button>
              <button
                onClick={onNavigateRegister}
                id="cta-bottom-register-btn"
                className="px-6 py-3.5 bg-transparent hover:bg-white/10 text-white font-extrabold text-sm rounded-xl border border-white/40 transition-all cursor-pointer"
              >
                Créer un compte
              </button>
            </div>
          </motion.div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 px-6 py-12 border-t border-slate-800 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-2xl p-2.5 shadow-lg">
              <img src="/logo-asf.png" alt="Aviation Sans Frontières France" className="h-12 w-auto object-contain" draggable={false} />
            </div>
            <div className="text-left">
              <span className="font-display font-bold text-white tracking-wide text-sm block">Aviation Sans Frontières</span>
              <p className="text-[10px] text-slate-400 mt-0.5">La première ONG aéronautique d’utilité publique en France</p>
            </div>
          </div>

          <div className="flex flex-col md:items-end text-center md:text-right space-y-1.5 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Une question ?</span>
            <a
              href="mailto:communication@aviation-sans-frontieres-fr.org"
              id="footer-email-link"
              className="text-azur-pastel hover:underline flex items-center justify-center md:justify-end gap-1.5 font-mono"
            >
              <Mail className="w-3.5 h-3.5" /> communication@aviation-sans-frontieres-fr.org
            </a>
            <p className="text-[10px] text-slate-500 pt-1">Tous droits réservés · Aviation Sans Frontières.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
