import React, { useState } from 'react';

/**
 * Petit Cessna (avion à aile haute) aux couleurs d'Aviation Sans Frontières.
 * Orienté vers la droite (vol de gauche à droite).
 *
 * En priorité, on affiche la VRAIE photo d'avion `public/cessna.png`
 * (idéalement détourée = fond transparent). Si le fichier est absent, on
 * retombe sur le dessin vectoriel intégré → aucune image cassée.
 *
 *  - variant "color" : photo réelle (ou fuselage bleu profond / ailes azur)
 *  - variant "white" : silhouette blanche vectorielle (fonds foncés)
 */
export default function CessnaPlane({
  className = 'w-28',
  variant = 'color',
  spin = true,
}: {
  className?: string;
  variant?: 'color' | 'white';
  spin?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // On affiche TOUJOURS la vraie photo du Cessna (fini les silhouettes SVG
  // « cartoon »), quel que soit le fond — y compris les bannières foncées.
  // La photo regarde vers la GAUCHE → on la retourne (-scale-x-100) pour
  // qu'elle « regarde » dans le sens du vol (vers la droite). Le dessin
  // vectoriel ne sert plus que de repli si l'image est introuvable.
  if (!imgFailed) {
    return (
      <img
        src="/cessna.png"
        alt="Cessna en vol"
        className={`${className} h-auto object-contain select-none -scale-x-100 drop-shadow-[0_10px_14px_rgba(10,70,89,0.28)]`}
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const body = variant === 'color' ? '#0e5e76' : '#ffffff';
  const wing = variant === 'color' ? '#1b98c4' : '#ffffff';
  const glass = variant === 'color' ? '#e8f5fb' : 'rgba(255,255,255,0.65)';
  const wheel = variant === 'color' ? '#0a4659' : '#ffffff';
  const propOpacity = variant === 'color' ? 0.22 : 0.35;

  return (
    <svg
      viewBox="0 0 240 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Cessna"
    >
      {/* Empennage horizontal */}
      <path d="M14 70 L54 66 L54 78 L14 80 Z" fill={wing} />
      {/* Dérive (aileron vertical) */}
      <path d="M30 64 L24 34 Q24 30 28 31 L50 60 Z" fill={body} />
      {/* Fuselage */}
      <path
        d="M40 62 Q44 54 78 53 L168 52 Q196 53 214 66 Q220 70 214 74 Q196 84 168 83 L78 83 Q44 82 40 74 Q36 68 40 62 Z"
        fill={body}
      />
      {/* Pare-brise + hublots */}
      <path d="M150 58 Q170 58 184 66 Q170 70 150 70 Z" fill={glass} />
      <circle cx="122" cy="62" r="5" fill={glass} />
      <circle cx="106" cy="62" r="5" fill={glass} />
      {/* Aile haute */}
      <path d="M70 50 L172 46 Q178 46 178 49 L176 53 L70 56 Q66 53 70 50 Z" fill={wing} />
      {/* Mât d'aile */}
      <line x1="96" y1="56" x2="92" y2="53" stroke={body} strokeWidth="3" />
      {/* Train d'atterrissage */}
      <line x1="96" y1="83" x2="92" y2="100" stroke={body} strokeWidth="4" />
      <line x1="150" y1="83" x2="156" y2="100" stroke={body} strokeWidth="4" />
      <circle cx="90" cy="103" r="7" fill={wheel} />
      <circle cx="158" cy="103" r="7" fill={wheel} />
      {/* Cône d'hélice */}
      <ellipse cx="216" cy="70" rx="5" ry="9" fill={wing} />
      {/* Hélice (disque en rotation) */}
      <g className={spin ? 'cessna-prop' : undefined} style={{ transformOrigin: '220px 70px' }}>
        <ellipse cx="220" cy="70" rx="3" ry="24" fill={wing} opacity={propOpacity} />
        <line x1="220" y1="46" x2="220" y2="94" stroke={body} strokeWidth="2.5" opacity="0.5" />
      </g>
    </svg>
  );
}
