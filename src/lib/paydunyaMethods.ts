/**
 * Moyens de paiement Mobile Money activés sur le compte marchand Paydunya
 * d'eganyé, par pays (capture d'écran du panneau Paydunya, 2026-08-31).
 * Les noms d'opérateurs sont des marques déposées : on ne les traduit pas.
 */
export interface PaydunyaOperator {
  value: string;
  label: string;
  /**
   * true = Paydunya peut débiter directement via son API SoftPay (l'appareil
   * du client reçoit une notification USSD/PIN à confirmer, sans jamais
   * quitter eganyé). Absent/false = on redirige vers la page hébergée
   * Paydunya, soit parce que l'opérateur exige un code OTP saisi côté
   * marchand (Orange Money CI/Burkina), soit parce que sa confirmation SoftPay
   * redirige de toute façon vers une page tierce (Wave, Djamo) — voir
   * api/create-paydunya-checkout.ts pour la correspondance exacte avec les
   * routes SoftPay de Paydunya.
   */
  direct?: boolean;
}

export interface PaydunyaCountry {
  code: string;
  label: string;
  /** Emoji drapeau — évite de charger des images externes pour un simple indicatif visuel. */
  flag: string;
  dialCode: string;
  operators: PaydunyaOperator[];
}

export const PAYDUNYA_COUNTRIES: PaydunyaCountry[] = [
  {
    code: 'tg',
    label: 'Togo',
    flag: '🇹🇬',
    dialCode: '+228',
    operators: [
      { value: 'tmoney_tg', label: 'T-Money (Togocom)', direct: true },
      { value: 'moov_tg', label: 'Flooz (Moov)', direct: true },
    ],
  },
  {
    code: 'sn',
    label: 'Sénégal',
    flag: '🇸🇳',
    dialCode: '+221',
    operators: [
      { value: 'orange_money_sn', label: 'Orange Money Sénégal', direct: true },
      { value: 'expresso_sn', label: 'Expresso SN', direct: true },
      { value: 'free_money_sn', label: 'Free Money Sénégal', direct: true },
      { value: 'wave_sn', label: 'Wave Sénégal' },
      { value: 'djamo_sn', label: 'Djamo SN' },
    ],
  },
  {
    code: 'bj',
    label: 'Bénin',
    flag: '🇧🇯',
    dialCode: '+229',
    operators: [
      { value: 'moov_bj', label: 'Moov Bénin', direct: true },
      { value: 'mtn_bj', label: 'MTN Bénin' },
      { value: 'celtiis_bj', label: 'Celtiis Cash', direct: true },
    ],
  },
  {
    code: 'bf',
    label: 'Burkina Faso',
    flag: '🇧🇫',
    dialCode: '+226',
    operators: [
      { value: 'orange_money_bf', label: 'Orange Money Burkina' },
      { value: 'moov_bf', label: 'Moov Burkina Faso', direct: true },
    ],
  },
  {
    code: 'ci',
    label: "Côte d'Ivoire",
    flag: '🇨🇮',
    dialCode: '+225',
    operators: [
      { value: 'orange_money_ci', label: 'Orange Money CI' },
      { value: 'mtn_ci', label: 'MTN CI' },
      { value: 'moov_ci', label: 'Moov CI', direct: true },
      { value: 'wave_ci', label: 'Wave CI' },
      { value: 'djamo_ci', label: 'Djamo CI' },
    ],
  },
  {
    code: 'ml',
    label: 'Mali',
    flag: '🇲🇱',
    dialCode: '+223',
    operators: [{ value: 'orange_money_ml', label: 'Orange Money Mali', direct: true }],
  },
  {
    code: 'cm',
    label: 'Cameroun',
    flag: '🇨🇲',
    dialCode: '+237',
    operators: [{ value: 'mtn_cm', label: 'MTN Cameroun' }],
  },
];

export function getOperatorsForCountry(countryCode: string): PaydunyaOperator[] {
  return PAYDUNYA_COUNTRIES.find((c) => c.code === countryCode)?.operators ?? [];
}

export function findCountryForOperator(operatorValue: string): string | null {
  for (const country of PAYDUNYA_COUNTRIES) {
    if (country.operators.some((op) => op.value === operatorValue)) return country.code;
  }
  return null;
}

export function findOperatorLabel(operatorValue: string): string {
  for (const country of PAYDUNYA_COUNTRIES) {
    const found = country.operators.find((op) => op.value === operatorValue);
    if (found) return found.label;
  }
  return operatorValue;
}
