/**
 * Configuration de l'envoi d'e-mails via EmailJS (https://www.emailjs.com).
 *
 * EmailJS envoie les e-mails directement depuis le navigateur, sans backend ni
 * extension Firebase à installer. Renseignez ces trois variables d'environnement
 * (dans Vercel ou `.env.local`) après avoir créé un service + un template :
 *
 *   VITE_EMAILJS_SERVICE_ID   = service_xxxxxxx
 *   VITE_EMAILJS_TEMPLATE_ID  = template_xxxxxxx
 *   VITE_EMAILJS_PUBLIC_KEY   = votre clé publique
 *
 * La clé publique EmailJS est conçue pour être exposée côté client (restreignez
 * les domaines autorisés dans le tableau de bord EmailJS pour la sécurité).
 *
 * Variables attendues par le template EmailJS :
 *   {{to_email}} (destinataire) · {{subject}} · {{message}} (texte) ·
 *   {{{message_html}}} (contenu HTML) · {{from_name}}
 */

const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;

const trim = (v: string | undefined): string => (v && v.trim() !== '' ? v.trim() : '');

/**
 * Valeurs par défaut du projet ASF (service Gmail EmailJS). Ces identifiants
 * sont publics par nature (visibles côté navigateur) ; la sécurité repose sur
 * la restriction de domaine configurée dans EmailJS → Account → Security.
 * Les variables d'environnement `VITE_EMAILJS_*` restent prioritaires.
 */
const DEFAULTS = {
  serviceId: 'service_xyxvema',
  templateId: 'template_exdzizv',
  publicKey: 'UCZY7NOyi2owwtjXv',
};

const orDefault = (v: string | undefined, fallback: string): string => {
  const t = trim(v);
  return t !== '' ? t : fallback;
};

export const emailjsConfig = {
  serviceId: orDefault(env.VITE_EMAILJS_SERVICE_ID, DEFAULTS.serviceId),
  templateId: orDefault(env.VITE_EMAILJS_TEMPLATE_ID, DEFAULTS.templateId),
  publicKey: orDefault(env.VITE_EMAILJS_PUBLIC_KEY, DEFAULTS.publicKey),
};

/** Vrai lorsque les trois identifiants EmailJS sont renseignés. */
export const emailjsConfigured: boolean =
  !!(emailjsConfig.serviceId && emailjsConfig.templateId && emailjsConfig.publicKey);
