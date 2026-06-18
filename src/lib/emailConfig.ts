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

export const emailjsConfig = {
  serviceId: trim(env.VITE_EMAILJS_SERVICE_ID),
  templateId: trim(env.VITE_EMAILJS_TEMPLATE_ID),
  publicKey: trim(env.VITE_EMAILJS_PUBLIC_KEY),
};

/** Vrai lorsque les trois identifiants EmailJS sont renseignés. */
export const emailjsConfigured: boolean =
  !!(emailjsConfig.serviceId && emailjsConfig.templateId && emailjsConfig.publicKey);
