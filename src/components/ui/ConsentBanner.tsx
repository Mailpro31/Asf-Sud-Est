/**
 * Bandeau d'information RGPD affiché à la première visite.
 *
 * Le portail n'utilise aucun traceur publicitaire / de mesure d'audience : seuls
 * des moyens de stockage strictement nécessaires (session, préférences) sont
 * employés, qui ne requièrent pas de consentement préalable. Ce bandeau a donc
 * un rôle d'information transparente + lien vers la politique de confidentialité.
 */

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { openLegal } from '../LegalModal';

const ACK_KEY = 'asf_rgpd_ack';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ACK_KEY)) setVisible(true);
    } catch {
      /* localStorage indisponible : on n'affiche rien plutôt que de bloquer */
    }
  }, []);

  const acknowledge = () => {
    try {
      localStorage.setItem(ACK_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9985] p-3 sm:p-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="w-10 h-10 rounded-xl bg-azur/10 text-azur dark:text-azur-pastel flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300 flex-1 min-w-0">
          Ce portail respecte votre vie privée : <strong>aucun traceur publicitaire ni mesure d'audience</strong>. Seuls des
          moyens strictement nécessaires (session, préférences) sont utilisés.{' '}
          <button type="button" onClick={() => openLegal('privacy')} className="font-bold text-azur dark:text-azur-pastel hover:underline cursor-pointer">
            En savoir plus
          </button>
          .
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="btn-asf text-xs shrink-0 justify-center w-full sm:w-auto"
        >
          J'ai compris
        </button>
      </div>
    </div>
  );
}
