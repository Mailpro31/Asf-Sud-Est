/**
 * Modale légale RGPD : Politique de confidentialité + Mentions légales.
 *
 * Montée une seule fois (dans App). On l'ouvre depuis n'importe où via
 * `openLegal('privacy' | 'legal')` qui émet un événement `window` —
 * même principe que `localdb-update`, sans prop-drilling.
 *
 * ⚠️ À COMPLÉTER : renseignez le contact « protection des données » et
 * l'adresse du siège dans `LEGAL_CONTACT` ci-dessous. Idéalement une adresse
 * dédiée (ex. dpo@…) plutôt que l'adresse de communication générale.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { X, ShieldCheck, Scale, Mail } from 'lucide-react';

export type LegalSection = 'privacy' | 'legal';

/** Coordonnées affichées dans les mentions — à adapter par ASF. */
export const LEGAL_CONTACT = {
  org: 'Aviation Sans Frontières',
  /** Contact pour l'exercice des droits RGPD. À remplacer par une adresse dédiée si disponible. */
  email: 'asf.aix@aviation-sans-frontieres-fr.org',
  /** Adresse postale du responsable de traitement. */
  address: '[Adresse du siège à compléter]',
  /** Date de dernière mise à jour de la politique. */
  updated: 'juin 2026',
};

const LEGAL_EVENT = 'asf:open-legal';

/** Ouvre la modale légale sur la section voulue depuis n'importe quel composant. */
export function openLegal(section: LegalSection = 'privacy') {
  window.dispatchEvent(new CustomEvent(LEGAL_EVENT, { detail: section }));
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-black text-deep dark:text-azur-pastel mt-5 mb-1.5 font-display">{children}</h3>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 mb-2">{children}</p>;
}
function Li({ children }: { children: ReactNode }) {
  return <li className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{children}</li>;
}

export default function LegalModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<LegalSection>('privacy');

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as LegalSection | undefined;
      setTab(detail === 'legal' ? 'legal' : 'privacy');
      setOpen(true);
    };
    window.addEventListener(LEGAL_EVENT, onOpen);
    return () => window.removeEventListener(LEGAL_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 dark:bg-slate-950/80 backdrop-blur-md" onClick={() => setOpen(false)}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 bg-azur/10 text-azur dark:text-azur-pastel rounded-xl shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black font-display text-deep dark:text-slate-100 truncate">Informations légales & confidentialité</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Conforme RGPD · mise à jour {LEGAL_CONTACT.updated}</p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 shrink-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
          {([['privacy', 'Confidentialité', ShieldCheck], ['legal', 'Mentions légales', Scale]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-colors cursor-pointer ${tab === key ? 'bg-white dark:bg-slate-900 text-azur dark:text-azur-pastel border border-b-0 border-slate-200 dark:border-slate-800' : 'text-slate-500 dark:text-slate-400 hover:text-deep dark:hover:text-slate-200'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 sm:px-7 py-5 text-left">
          {tab === 'privacy' ? (
            <>
              <P>
                {LEGAL_CONTACT.org} attache une grande importance à la protection de vos données personnelles.
                Cette politique explique quelles données sont traitées via le portail documentaire « Les Ailes du Sourire »,
                pourquoi, et quels sont vos droits, conformément au Règlement général sur la protection des données (RGPD)
                et à la loi « Informatique et Libertés ».
              </P>

              <H>1. Responsable du traitement</H>
              <P>{LEGAL_CONTACT.org} — {LEGAL_CONTACT.address}. Contact protection des données : {LEGAL_CONTACT.email}.</P>

              <H>2. Données collectées</H>
              <ul className="list-disc pl-5 space-y-1 mb-2">
                <Li><strong>Compte & organisme</strong> : nom de la structure, nom du contact, e-mail, téléphone, antenne de rattachement.</Li>
                <Li><strong>Documents déposés</strong> : justificatifs et pièces réglementaires que vous transmettez.</Li>
                <Li><strong>Données d'usage</strong> : journal d'activité (dépôts, validations, modifications) à des fins de traçabilité.</Li>
                <Li><strong>Données techniques</strong> : identifiant de connexion et informations strictement nécessaires au fonctionnement du service.</Li>
              </ul>

              <H>3. Finalités & base légale</H>
              <P>
                Les données servent exclusivement à gérer les autorisations de vol des organismes partenaires : création de compte,
                validation des dossiers par l'antenne, communication relative aux dossiers. La base légale est l'exécution de la
                relation entre {LEGAL_CONTACT.org} et l'organisme partenaire, ainsi que votre consentement lors de l'inscription.
                Aucune donnée n'est utilisée à des fins publicitaires ; aucun profilage n'est réalisé.
              </P>

              <H>4. Destinataires</H>
              <P>
                Vos données sont accessibles uniquement aux personnes habilitées d'{LEGAL_CONTACT.org} (coordinateurs de votre antenne
                et de la délégation) dans la stricte mesure nécessaire à leurs missions. Un cloisonnement par organisme / antenne /
                délégation est appliqué.
              </P>

              <H>5. Hébergement & sous-traitants</H>
              <P>Le service s'appuie sur des prestataires techniques agissant comme sous-traitants :</P>
              <ul className="list-disc pl-5 space-y-1 mb-2">
                <Li><strong>Google Firebase</strong> (authentification, base de données, stockage des fichiers).</Li>
                <Li><strong>Vercel</strong> (hébergement de l'application web).</Li>
                <Li><strong>EmailJS</strong> (envoi des e-mails de notification).</Li>
              </ul>
              <P>
                Ces prestataires peuvent impliquer des transferts hors Union européenne, encadrés par les garanties appropriées
                (clauses contractuelles types de la Commission européenne). L'infrastructure est chiffrée en transit et au repos.
              </P>

              <H>6. Durée de conservation</H>
              <P>
                Les données sont conservées le temps de la relation avec l'organisme partenaire, puis archivées ou supprimées
                conformément aux obligations légales applicables. Vous pouvez demander la suppression de votre compte à tout moment.
              </P>

              <H>7. Vos droits</H>
              <P>
                Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de
                vos données. Pour les exercer, écrivez à {LEGAL_CONTACT.email}. Vous pouvez également introduire une réclamation
                auprès de la CNIL (www.cnil.fr).
              </P>

              <H>8. Cookies & stockage local</H>
              <P>
                Le portail n'utilise <strong>aucun cookie publicitaire ni traceur de mesure d'audience</strong>. Seuls des moyens
                de stockage strictement nécessaires sont employés : maintien de votre session (authentification) et mémorisation de
                vos préférences (thème clair/sombre, notifications déjà vues). Ces éléments ne requièrent pas de consentement
                préalable mais sont décrits ici par transparence.
              </P>

              <H>9. Sécurité</H>
              <P>
                Accès protégé par authentification, règles de sécurité serveur restreignant chaque utilisateur à ses propres données,
                et journal d'audit des actions. Nous mettons en œuvre des mesures techniques et organisationnelles adaptées.
              </P>
            </>
          ) : (
            <>
              <H>Éditeur du site</H>
              <P>{LEGAL_CONTACT.org} — {LEGAL_CONTACT.address}. Contact : {LEGAL_CONTACT.email}.</P>

              <H>Directeur de la publication</H>
              <P>Le représentant légal d'{LEGAL_CONTACT.org}. [Nom à compléter]</P>

              <H>Hébergement</H>
              <P>
                Application hébergée par Vercel Inc. Données et fichiers hébergés via l'infrastructure Google Firebase
                (Google Ireland Ltd / Google LLC).
              </P>

              <H>Propriété intellectuelle</H>
              <P>
                L'ensemble des éléments du portail (marques, logos, textes, interface) est la propriété d'{LEGAL_CONTACT.org} ou de
                ses partenaires. Toute reproduction non autorisée est interdite. Les documents déposés restent la propriété de
                l'organisme qui les transmet.
              </P>

              <H>Responsabilité</H>
              <P>
                {LEGAL_CONTACT.org} met tout en œuvre pour assurer l'exactitude des informations et la disponibilité du service,
                sans garantie d'absence d'interruption. Les organismes partenaires sont responsables de l'exactitude des documents
                qu'ils transmettent.
              </P>

              <H>Protection des données</H>
              <P>
                Le traitement des données personnelles est décrit dans l'onglet « Confidentialité ». Pour toute question relative à
                vos données : {LEGAL_CONTACT.email}.
              </P>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <a href={`mailto:${LEGAL_CONTACT.email}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-azur dark:text-azur-pastel hover:underline">
              <Mail className="w-3.5 h-3.5" /> {LEGAL_CONTACT.email}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
