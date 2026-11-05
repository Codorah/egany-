/**
 * Comptes sans adresse e-mail : inscription avec un numéro de téléphone.
 *
 * Supabase Auth identifie un compte « mot de passe » par un e-mail. Plutôt que
 * d'activer le fournisseur téléphone (qui impose un fournisseur SMS payant),
 * on dérive du numéro une adresse technique sur un sous-domaine qui ne reçoit
 * aucun courrier : 22890123456@tel.eganye.codorah.com. La personne ne la voit
 * jamais : elle tape son numéro, l'app traduit.
 *
 * Ces adresses ne doivent JAMAIS recevoir d'e-mail (rebonds = mauvaise
 * réputation d'envoi) : api/notify.ts et api/send-email.ts les ignorent.
 * La même règle est recopiée dans api/_phoneAccount.ts.
 */
export const PHONE_ACCOUNT_DOMAIN = 'tel.eganye.codorah.com';

/** Indicatif par défaut quand la personne tape un numéro local à 8 chiffres (Togo). */
const DEFAULT_DIAL_CODE = '228';

/**
 * Ramène une saisie libre (« 90 12 34 56 », « +228 90123456 », « 0022890123456 »)
 * au format international « +22890123456 ». null si ce n'est pas un numéro.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (trimmed.startsWith('+')) {
    // déjà international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.length === 8) {
    digits = DEFAULT_DIAL_CODE + digits;
  } else {
    return null;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function phoneToAccountEmail(phone: string): string {
  return `${phone.replace(/\D/g, '')}@${PHONE_ACCOUNT_DOMAIN}`;
}

export function isPhoneAccountEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PHONE_ACCOUNT_DOMAIN}`);
}

/** Numéro de connexion d'un compte téléphone (« +22890123456 »), sinon undefined. */
export function phoneFromAccountEmail(email?: string | null): string | undefined {
  if (!isPhoneAccountEmail(email)) return undefined;
  return `+${email!.split('@')[0]}`;
}

/** Ce qu'on affiche pour joindre la personne : son e-mail, ou son numéro de connexion. */
export function accountContact(email?: string | null): string {
  return phoneFromAccountEmail(email) ?? (email || '');
}
