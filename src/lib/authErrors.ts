/**
 * Traduit les codes d'erreur Firebase Auth en messages clairs en français.
 *
 * Firebase renvoie des messages techniques (« Firebase: Error
 * (auth/invalid-credential). ») peu compréhensibles pour l'utilisateur.
 * On les convertit en phrases lisibles et rassurantes.
 */

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': "L'adresse e-mail n'est pas valide.",
  'auth/user-disabled': "Ce compte a été désactivé. Contactez un administrateur.",
  'auth/user-not-found': "Aucun compte ne correspond à cette adresse e-mail.",
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/invalid-credential': "E-mail ou mot de passe incorrect.",
  'auth/invalid-login-credentials': "E-mail ou mot de passe incorrect.",
  'auth/missing-password': 'Veuillez saisir votre mot de passe.',
  'auth/missing-email': 'Veuillez saisir votre adresse e-mail.',
  'auth/too-many-requests': 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.',
  'auth/network-request-failed': 'Problème de connexion réseau. Vérifiez votre connexion internet.',
  'auth/email-already-in-use': 'Cette adresse e-mail est déjà associée à un compte.',
  'auth/weak-password': 'Mot de passe trop faible (6 caractères minimum).',
  'auth/requires-recent-login': 'Pour des raisons de sécurité, reconnectez-vous puis réessayez cette action.',
  'auth/popup-closed-by-user': 'La fenêtre de connexion a été fermée avant la fin.',
  'auth/popup-blocked': 'La fenêtre de connexion a été bloquée par le navigateur.',
  'auth/cancelled-popup-request': 'Connexion annulée.',
  'auth/account-exists-with-different-credential':
    'Un compte existe déjà avec cette adresse via une autre méthode de connexion.',
  'auth/operation-not-allowed': "Cette méthode de connexion n'est pas activée.",
  'auth/expired-action-code': 'Ce lien a expiré. Veuillez recommencer.',
  'auth/invalid-action-code': "Ce lien n'est pas valide ou a déjà été utilisé.",
};

/** Renvoie un message d'erreur lisible à partir d'une erreur Firebase (ou autre). */
export function authErrorMessage(err: unknown, fallback = 'Une erreur est survenue. Veuillez réessayer.'): string {
  const code = (err as any)?.code as string | undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  // Certaines erreurs n'ont pas de `code` mais un message contenant le code.
  const msg = (err as any)?.message as string | undefined;
  if (msg) {
    const m = msg.match(/auth\/[a-z-]+/);
    if (m && MESSAGES[m[0]]) return MESSAGES[m[0]];
  }
  return fallback;
}
