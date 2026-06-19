/**
 * Visite guidée (tutoriel) — surbrillance « spotlight » + bulle explicative.
 *
 * Pilotée par une liste d'étapes ciblant des éléments via un sélecteur CSS
 * (typiquement `[data-tour="id"]`). Réutilisable sur tous les dashboards :
 * il suffit de poser des attributs `data-tour` sur les zones à présenter et
 * de fournir les étapes adaptées au rôle de l'utilisateur.
 *
 * Affichage volontairement sans portail (comme les modales du projet) :
 * un calque plein écran en position fixe avec un z-index élevé.
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { X, ChevronRight, GraduationCap } from 'lucide-react';

export interface TourStep {
  /** Sélecteur CSS de la cible, ex. `[data-tour="kpi"]`. */
  target: string;
  title: string;
  text: string;
}

export interface GuidedTourProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}

interface Box { top: number; left: number; width: number; height: number; }

/** Premier élément *visible* correspondant au sélecteur (gère desktop/mobile). */
function resolveTarget(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
  for (const el of els) {
    if (el.getClientRects().length > 0) return el;
  }
  return els[0] || null;
}

const PAD = 8;
const POP_W = 320;
const POP_H = 210;

export function GuidedTour({ steps, open, onClose }: GuidedTourProps) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const measure = useCallback(() => {
    const step = steps[index];
    if (!step) { setBox(null); return; }
    const el = resolveTarget(step.target);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [steps, index]);

  // Recentre la cible puis mesure à chaque changement d'étape / ouverture.
  useLayoutEffect(() => {
    if (!open) return;
    const idx = Math.max(0, Math.min(index, steps.length - 1));
    const step = steps[idx];
    const el = step ? resolveTarget(step.target) : null;
    if (!el) {
      // Cible absente de l'écran : on n'encadre pas le vide, on passe
      // directement à l'étape suivante affichable (sinon bulle centrée).
      if (idx < steps.length - 1) { setIndex(idx + 1); return; }
      setBox(null);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(measure, 320);
    return () => clearTimeout(t);
  }, [open, index, steps, measure]);

  // Suit les redimensionnements et défilements (y compris conteneurs internes).
  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  // Réinitialise sur ouverture ; gère le clavier.
  useEffect(() => {
    if (!open) { setIndex(0); return; }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, steps.length]);

  if (!open || steps.length === 0) return null;

  // L'ordre des étapes peut changer pendant la visite (ex. liste de documents
  // qui se vide) : on borne l'index pour ne jamais déréférencer un step absent.
  const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;

  // Position de la bulle : sous la cible, sinon au-dessus, sinon centrée.
  let popStyle: any;
  if (box) {
    let top = box.top + box.height + 14;
    if (top + POP_H > window.innerHeight) top = box.top - POP_H - 14;
    if (top < 12) top = 12;
    let left = box.left;
    if (left + POP_W > window.innerWidth - 12) left = window.innerWidth - POP_W - 12;
    popStyle = { top, left: Math.max(12, left) };
  } else {
    popStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const next = () => { if (isLast) onClose(); else setIndex(safeIndex + 1); };

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Voile + surbrillance */}
      {box ? (
        <div
          className="absolute rounded-2xl pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(10,70,89,0.62)',
            border: '2.5px solid #f39200',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-deep-dark/60" />
      )}
      {/* Capte les clics hors bulle pour fermer */}
      <button aria-label="Fermer le tutoriel" className="absolute inset-0 w-full h-full cursor-default" onClick={onClose} />

      {/* Bulle */}
      <div
        className="absolute w-[320px] bg-white rounded-2xl shadow-asf-lg p-5 transition-all duration-300 ease-out"
        style={popStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sourire-dark inline-flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" /> Étape {safeIndex + 1} / {steps.length}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" title="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h4 className="font-display text-lg font-bold text-deep mb-1.5">{step.title}</h4>
        <p className="text-sm text-slate-600 leading-relaxed">{step.text}</p>
        <div className="flex items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
            {steps.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full shrink-0 transition-all ${k === safeIndex ? 'w-4 bg-sourire' : 'w-1.5 bg-slate-200'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {safeIndex > 0 && (
              <button onClick={() => setIndex(safeIndex - 1)} className="text-sm font-bold px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 whitespace-nowrap">
                Précédent
              </button>
            )}
            <button onClick={next} className="text-sm font-bold px-3.5 py-1.5 rounded-lg bg-sourire hover:bg-sourire-dark text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0">
              {isLast ? 'Terminer' : 'Suivant'} {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuidedTour;
