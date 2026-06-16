import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Compass, Calendar, CheckCircle2, ChevronRight, Users, Heart, ClipboardCheck, ArrowRight, Menu, X, Mail, Upload } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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

export default function LandingPage({ onNavigateLogin, onNavigateRegister }: LandingPageProps) {
  const { themeConfig } = useTheme();

  const officialMissions = [
    { title: "Missions Avions", subtitle: "Avion-Hôpital et Drone Humanitaire", desc: "Transport de médecins, de médicaments et d'aide urgente au plus près des populations isolées." },
    { title: "Accompagnements d'Enfants Malades", subtitle: "Soins d'urgence à l'étranger", desc: "Prise en charge d'enfants malades transférés pour être opérés en Europe." },
    { title: "Messagerie Médicale & Fret Humanitaire", subtitle: "Logistique solidaire", desc: "Expédition facilitée de colis de secours, vaccins, et matériel médical partout dans le monde." },
    { title: "Accompagnements de Réfugiés", subtitle: "Vers de nouveaux horizons", desc: "Assistance et accueil des réfugiés lors de leurs voyages de réinstallation officiels." },
    { title: "Ailes du Sourire", subtitle: "L'envol thérapeutique", desc: "Vols de découverte et d'initiation aéronautique pour personnes en situation de handicap physique, mental ou d'exclusion sociale.", highlight: true },
    { title: "Ailes de l'Avenir", subtitle: "Insertion des jeunes", desc: "Ateliers de découverte des métiers de l'aérien pour favoriser l'insertion de jeunes en difficulté." },
    { title: "e-Aviation", subtitle: "Éducation & sensibilisation", desc: "Outils et formations numériques pour rapprocher les populations de l'écosystème de l'aviation humanitaire." }
  ];

  return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 text-slate-850 overflow-x-hidden antialiased font-sans">
      
      {/* Top Banner Header decoration */}
      <div className="bg-deep text-white py-2 px-4 text-center text-xs font-medium tracking-wide">
        Portail documentaire officiel — <span className="font-semibold">Aviation Sans Frontières · Les Ailes du Sourire</span>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoASF className="w-10 h-10 transition-transform hover:scale-105 duration-300" variant="color" />
            <div className="flex flex-col">
              <span className="font-display font-bold text-azur tracking-wide text-sm md:text-base">
                AVIATION Sans Frontières
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
                Les Ailes de l'Humanitaire
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateLogin}
              id="cta-top-login"
              className="text-xs font-bold text-slate-600 hover:text-azur px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              Se connecter
            </button>
            <button
              onClick={onNavigateRegister}
              id="cta-top-register"
              className="text-xs font-bold bg-sourire hover:bg-sourire-dark text-white px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              Créer un compte
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="flex-grow">
        
        {/* Hero Section */}
        <section className="relative px-6 py-16 md:py-24 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/50">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* CTA Left Column */}
            <div className="lg:col-span-6 flex flex-col items-start text-left space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="px-3 py-1 rounded-full text-[10px] font-bold text-deep bg-azur/10 tracking-widest uppercase border border-azur/25"
              >
                Portail documentaire · Les Ailes du Sourire
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl md:text-5xl font-black tracking-tight text-deep font-display leading-[1.1]"
              >
                Vos dossiers et certificats,<br />
                <span className="text-azur">transmis en toute simplicité</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-slate-600 text-sm md:text-base leading-relaxed max-w-xl font-sans"
              >
                Déposez, suivez et faites valider en quelques clics les documents nécessaires aux vols
                <span className="font-semibold text-deep"> Les Ailes du Sourire</span> d'Aviation Sans Frontières.
                Un espace clair et sécurisé, au service de chaque sourire qui s'envole.
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
              >
                <button
                  onClick={onNavigateRegister}
                  id="cta-hero-register"
                  className="btn-sourire text-sm cursor-pointer group"
                >
                  Créer mon compte
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={onNavigateLogin}
                  id="cta-hero-login"
                  className="btn-asf text-sm cursor-pointer"
                >
                  Accéder à mon espace
                </button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-xs font-medium text-slate-500"
              >
                Le dépôt de documents nécessite un compte partenaire validé.
              </motion.p>

              {/* Mini counters */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="grid grid-cols-3 gap-8 pt-6 border-t border-slate-200/80 w-full"
              >
                <div>
                  <span className="block text-xl md:text-2xl font-black text-azur">800+</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Bénévoles</span>
                </div>
                <div>
                  <span className="block text-xl md:text-2xl font-black text-azur">45 ans</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Service public</span>
                </div>
                <div>
                  <span className="block text-xl md:text-2xl font-black text-azur">20+</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Missions / jour</span>
                </div>
              </motion.div>
            </div>

            {/* Right Image/Graphic Column */}
            <div className="lg:col-span-6 relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
              >
                {/* Aircraft image representing flight */}
                <img 
                  src="https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1200&q=80" 
                  alt="Aviation Sans Frontières en plein vol"
                  className="w-full h-80 md:h-[420px] object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Overlay card */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-6 text-white text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[8px] tracking-widest font-bold uppercase bg-azur">MISSION</span>
                    <p className="text-[11px] font-mono tracking-wider opacity-90">Opérations Air & Terre</p>
                  </div>
                  <h3 className="text-lg font-bold font-display">Aviation Sans Frontières : Les Ailes de l'Humanitaire</h3>
                  <p className="text-xs opacity-75 mt-1 leading-relaxed">
                    Nous mobilisons l'expertise du monde de l'aviation pour secourir, soigner et acheminer de l'aide auprès des populations marginalisées.
                  </p>
                </div>
              </motion.div>

              {/* Decorative cloud path outline */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-azur/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-azur-pastel/10 rounded-full blur-2xl pointer-events-none"></div>
            </div>

          </div>
        </section>

        {/* Focus on: Ailes du Sourire Section based on official description */}
        <section className="px-6 py-16 bg-white border-b border-slate-200/50">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded bg-azur/15 text-azur text-xs font-bold tracking-widest uppercase font-mono">
                Focus Solidaire : Ailes du Sourire
              </span>
              <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight text-deep">
                L'Évasion pour Tous : L'Envol Thérapeutique
              </h2>
              <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
                Le programme <span className="font-bold text-azur">Ailes du Sourire</span> rompt l'isolement et offre des moments de partage magiques dans les airs aux personnes touchées par le handicap ou d'importantes précarités.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              
              {/* Left Side: Images of Ailes du Sourire */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden shadow-md border hover:scale-[1.02] transition-transform duration-300">
                    <img 
                      src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80" 
                      alt="Sourire d'un enfant en vol" 
                      className="w-full h-44 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-md border bg-slate-100 p-4 flex flex-col justify-between h-36">
                    <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                    <div>
                      <p className="text-xs italic text-slate-600">"Un enfant qui décolle, c'est son handicap qui reste à terre le temps d'un vol."</p>
                      <span className="text-[9px] font-mono font-bold block mt-1.5">— Pilote Bénévole</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 pt-8">
                  <div className="bg-azur/5 rounded-xl border border-azur/10 p-5 h-36 flex flex-col justify-center text-left">
                    <span className="text-3xl font-black text-azur block">96%</span>
                    <h4 className="text-xs font-bold text-deep">Sourires & Évasion</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-1">Un impact thérapeutique prouvé, renforçant l'estime de soi.</p>
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-md border hover:scale-[1.02] transition-transform duration-300">
                    <img 
                      src="https://images.unsplash.com/photo-1471286174240-6ac129e742e1?auto=format&fit=crop&w=800&q=80" 
                      alt="Partage et co-pilote" 
                      className="w-full h-44 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side: Description and Benefits */}
              <div className="text-left space-y-6">
                <div>
                  <h3 className="text-lg font-bold font-display text-deep flex items-center gap-2">
                    <Compass className="w-5 h-5 text-azur" />
                    Qu'est-ce que les Ailes du Sourire ?
                  </h3>
                  <p className="text-slate-600 text-xs md:text-sm leading-relaxed mt-2.5">
                    Dans le respect le plus strict des chartes de sécurité et d'encadrement, les délégations régionales d'Aviation Sans Frontières s'organisent avec des aéroclubs partenaires pour convier des personnes souffrant d'un handicap ou de difficultés sociales à des journées d'initiation. C'est l'occasion de découvrir les bases de la navigation aérienne sous la tutelle de pilotes certifiés et de réaliser un baptême de l'air magique.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-azur shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-deep">Vols de Découverte Aérienne</h4>
                      <p className="text-[11px] text-slate-500">Chaque passager prend place à bord d'un avion léger aux côtés d'un pilote chevronné pour un parcours d'évasion inoubliable au-dessus des plus belles régions.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-azur shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-deep">Coordination Réglementaire Renforcée</h4>
                      <p className="text-[11px] text-slate-500">Chaque vol d'Ailes du Sourire demande un protocole de sécurité et d'autorisation d'accès dont la validation est orchestrée via notre portail numérique de gestion.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-azur shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-deep">Réseau d'Aéroclubs & Partenaires</h4>
                      <p className="text-[11px] text-slate-500">Nous facilitons le travail conjoint entre les établissements de santé (IME, SESSAD, Foyers), les aéroclubs hôtes et nos équipes d'accompagnants.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={onNavigateLogin}
                    id="cta-ailes-sourire"
                    className="px-5 py-2.5 bg-azur/10 hover:bg-azur/20 border border-azur/20 text-azur text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    Consulter les dossiers de vol en cours <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Overview of official missions */}
        <section className="px-6 py-16 bg-slate-100 border-b border-slate-200/40">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-xl mx-auto space-y-3 mb-12">
              <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight text-deep">
                Nos Domaines d'Actions Majeurs
              </h2>
              <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
                Aviation Sans Frontières intervient sur un panel étendu d'activités logistiques, humanitaires et d'intégration à travers la France et le monde entier.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {officialMissions.map((item, index) => (
                <div 
                  key={index}
                  className={`p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between items-start transition-transform hover:-translate-y-1 duration-200 relative ${item.highlight ? 'ring-2 ring-azur ring-offset-2' : ''}`}
                >
                  {item.highlight && (
                    <span className="absolute top-3 right-3 bg-azur text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                      Mission Phare
                    </span>
                  )}
                  
                  <div className="space-y-2">
                    <span className="text-[10px] tracking-wider uppercase font-black text-slate-400 block font-mono">
                      {item.subtitle}
                    </span>
                    <h3 className="text-sm font-bold text-deep font-display">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      {item.desc}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t w-full text-right">
                    <button
                      onClick={onNavigateLogin}
                      className="text-[10px] font-bold text-azur hover:underline cursor-pointer"
                    >
                      Voir les dossiers liés →
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* Minimalist CTA banner for account access */}
        <section className="px-6 py-20 bg-gradient-to-r from-deep to-azur text-white relative overflow-hidden">
          
          {/* Decorative elements */}
          <div className="absolute -right-16 -top-16 w-60 h-60 bg-white/5 rounded-full blur-2xl"></div>
          <div className="absolute -left-16 -bottom-16 w-60 h-60 bg-white/5 rounded-full blur-2xl"></div>

          <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10 flex flex-col items-center">
            <LogoASF className="w-16 h-16 animate-bounce" variant="white" />
            
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display">
              Accédez au Portail Aviation Sans Frontières
            </h2>
            <p className="text-sm text-sky-100 max-w-xl mx-auto leading-relaxed">
              Connectez-vous dès maintenant pour compléter votre fiche d'organisation, uploader vos récépissés réglementaires, et collaborer avec nos chefs de mission.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 w-full sm:w-auto justify-center">
              <button
                onClick={onNavigateLogin}
                id="cta-bottom-login-btn"
                className="px-8 py-3.5 bg-white hover:bg-slate-55 text-azur font-black text-sm rounded-xl tracking-wide shadow-lg hover:-translate-y-0.5 transition-all text-center cursor-pointer"
              >
                Se connecter à l'espace membre / partenaire
              </button>
              <button
                onClick={onNavigateRegister}
                id="cta-bottom-register-btn"
                className="px-6 py-3.5 bg-transparent hover:bg-white/10 text-white font-extrabold text-sm rounded-xl border border-white/40 transition-all text-center cursor-pointer"
              >
                Créer un compte
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Footer conforming to contact guidelines (page 19) */}
      <footer className="bg-slate-900 text-slate-300 px-6 py-12 border-t border-slate-800 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <LogoASF className="w-10 h-10" variant="white" />
            <div className="text-left">
              <span className="font-display font-bold text-white tracking-wide text-sm">
                AVIATION Sans Frontières
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">La première ONG aéronautique d'utilité publique en France</p>
            </div>
          </div>

          <div className="flex flex-col md:items-end text-center md:text-right space-y-1.5 text-xs">
            <span className="font-bold text-white uppercase tracking-wider text-[10px] text-slate-400">Une Question ?</span>
            <a 
              href="mailto:communication@aviation-sans-frontieres-fr.org"
              id="footer-email-link"
              className="text-azur-pastel hover:underline flex items-center justify-center md:justify-end gap-1.5 font-mono"
            >
              <Mail className="w-3.5 h-3.5" /> communication@aviation-sans-frontieres-fr.org
            </a>
            <p className="text-[10px] text-slate-500 pt-1">
              Dernière mise à jour de la charte graphique : 05.05.2026. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
