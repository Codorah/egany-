import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';
import { requireUser } from './_requireUser.js';

/**
 * Retraits Mobile Money via l'API de décaissement PayDunya.
 * Doc : https://developers.paydunya.com/doc/EN/api_deboursement
 *
 * Un seul fichier pour toutes les actions (?action=) : l'offre Hobby de Vercel
 * limite un déploiement à 12 fonctions, et celle-ci est la douzième.
 *
 * Règles, parce qu'un envoi Mobile Money ne se rattrape pas :
 *  1. Le code PIN est vérifié ici, côté serveur, avant tout débit.
 *  2. Montant, numéro et opérateur viennent de la ligne en base, jamais de la
 *     requête, une fois le débit fait.
 *  3. Une seule exécution à la fois : on « réserve » la ligne par une mise à
 *     jour conditionnelle (payout_state) avant d'appeler PayDunya.
 *  4. Le jeton PayDunya est enregistré AVANT de soumettre l'envoi : si la
 *     fonction s'arrête en route, on peut toujours retrouver l'issue réelle.
 *  5. Seul check-status fait foi. Une réponse illisible ou une coupure réseau
 *     ne veut pas dire « échec » : le retrait reste « en cours ».
 *  6. Ce fichier ne rembourse jamais. Un envoi refusé retourne dans la file de
 *     l'Admin, où un humain renvoie ou rembourse.
 */

type PayoutState = 'sent' | 'processing' | 'manual' | 'failed';
type CheckStatus = 'success' | 'pending' | 'created' | 'failed' | 'unknown';

interface PayoutRoute {
  mode: string;
  label: string;
  dial: string;
  lengths: number[];
}

// Clé : valeur eganyé (src/lib/paydunyaMethods.ts). `mode` : withdraw_mode de la
// doc PayDunya. Garder les libellés alignés sur paydunyaMethods.ts.
const PAYOUT_ROUTES: Record<string, PayoutRoute> = {
  tmoney_tg: { mode: 't-money-togo', label: 'Mixx (Yas)', dial: '228', lengths: [8] },
  moov_tg: { mode: 'moov-togo', label: 'Flooz (Moov)', dial: '228', lengths: [8] },
  orange_money_sn: { mode: 'orange-money-senegal', label: 'Orange Money Sénégal', dial: '221', lengths: [9] },
  expresso_sn: { mode: 'expresso-senegal', label: 'Expresso SN', dial: '221', lengths: [9] },
  free_money_sn: { mode: 'free-money-senegal', label: 'Free Money Sénégal', dial: '221', lengths: [9] },
  wave_sn: { mode: 'wave-senegal', label: 'Wave Sénégal', dial: '221', lengths: [9] },
  djamo_sn: { mode: 'djamo-sn', label: 'Djamo SN', dial: '221', lengths: [9] },
  moov_bj: { mode: 'moov-benin', label: 'Moov Bénin', dial: '229', lengths: [8, 10] },
  mtn_bj: { mode: 'mtn-benin', label: 'MTN Bénin', dial: '229', lengths: [8, 10] },
  celtiis_bj: { mode: 'celtiis-cash', label: 'Celtiis Cash', dial: '229', lengths: [8, 10] },
  orange_money_bf: { mode: 'orange-money-burkina', label: 'Orange Money Burkina', dial: '226', lengths: [8] },
  moov_bf: { mode: 'moov-burkina-faso', label: 'Moov Burkina Faso', dial: '226', lengths: [8] },
  orange_money_ci: { mode: 'orange-money-ci', label: 'Orange Money CI', dial: '225', lengths: [10] },
  mtn_ci: { mode: 'mtn-ci', label: 'MTN CI', dial: '225', lengths: [10] },
  moov_ci: { mode: 'moov-ci', label: 'Moov CI', dial: '225', lengths: [10] },
  wave_ci: { mode: 'wave-ci', label: 'Wave CI', dial: '225', lengths: [10] },
  djamo_ci: { mode: 'djamo-ci', label: 'Djamo CI', dial: '225', lengths: [10] },
  orange_money_ml: { mode: 'orange-money-mali', label: 'Orange Money Mali', dial: '223', lengths: [8] },
  mtn_cm: { mode: 'mtn-cameroun', label: 'MTN Cameroun', dial: '237', lengths: [9] },
};

const DISBURSE_BASE = 'https://app.paydunya.com/api/v2/disburse/';
const MIN_WITHDRAWAL = 500;

/** La doc demande le numéro sans indicatif. Renvoie null si le numéro n'a pas la bonne longueur. */
function toAccountAlias(phone: string, route: PayoutRoute): string | null {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(route.dial) && route.lengths.includes(digits.length - route.dial.length)) {
    return digits.slice(route.dial.length);
  }
  return route.lengths.includes(digits.length) ? digits : null;
}

function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Client qui agit AU NOM de la personne connectée : auth.uid() marche dans les fonctions SQL. */
function callerClient(req: any) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const header: string = req.headers?.authorization || req.headers?.Authorization || '';
  return createClient(url as string, key as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: header } },
  });
}

function paydunyaConfigured(): boolean {
  return Boolean(process.env.PAYDUNYA_MASTER_KEY && process.env.PAYDUNYA_PRIVATE_KEY && process.env.PAYDUNYA_TOKEN);
}

async function paydunyaPost(path: string, body: object, timeoutMs: number): Promise<any> {
  const response = await fetch(DISBURSE_BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY as string,
      'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY as string,
      'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN as string,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return response.json();
}

async function checkStatus(token: string): Promise<{ status: CheckStatus; data: any }> {
  try {
    const data = await paydunyaPost('check-status', { disburse_invoice: token }, 10000);
    if (data?.response_code !== '00') return { status: 'unknown', data };
    const value = String(data?.status || '').toLowerCase();
    if (value === 'success' || value === 'pending' || value === 'created' || value === 'failed') {
      return { status: value, data };
    }
    return { status: 'unknown', data };
  } catch (error) {
    console.error('[payout] check-status injoignable :', error);
    return { status: 'unknown', data: null };
  }
}

function stateOf(row: any): PayoutState {
  if (row.status === 'completed') return 'sent';
  if (row.status === 'failed') return 'failed';
  return row.payout_state === 'processing' ? 'processing' : 'manual';
}

/** Ce qui a quitté le portefeuille, frais compris. */
function debitOf(row: any): number {
  return Math.abs(Number(row.amount));
}

/** Ce qu'il faut envoyer. Anciennes lignes sans frais : égal au débit. */
function amountOf(row: any): number {
  return row.payout_amount === null || row.payout_amount === undefined
    ? debitOf(row)
    : Number(row.payout_amount);
}

function fcfa(value: number): string {
  return value.toLocaleString('fr-FR');
}

function destinationOf(row: any): string {
  const label = PAYOUT_ROUTES[row.payment_method]?.label || String(row.payment_method || '').toUpperCase();
  return `${label} (${row.reference})`;
}

async function notify(db: any, userId: string, title: string, message: string) {
  const { error } = await db.from('notifications').insert({ user_id: userId, title, message, type: 'system', read: false });
  if (error) console.error('[payout] Notification non enregistrée :', error);
}

function startedSecondsAgo(row: any): number {
  if (!row.payout_started_at) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(row.payout_started_at).getTime()) / 1000;
}

async function notifyAdmins(db: any, row: any, reason: string) {
  const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
  if (!admins?.length) return;
  const { error } = await db.from('notifications').insert(admins.map((admin: any) => ({
    user_id: admin.id,
    title: 'Retrait à traiter',
    message: `${fcfa(amountOf(row))} FCFA vers ${destinationOf(row)} : ${reason}`,
    type: 'system',
    read: false,
  })));
  if (error) console.error('[payout] Alerte admin non enregistrée :', error);
}

/** Envoi confirmé par PayDunya. Ne s'applique qu'une fois, grâce au filtre sur status. */
async function markSent(db: any, row: any, data: any): Promise<PayoutState> {
  const reference = data?.disburse_tx_id || data?.provider_ref || data?.transaction_id || row.payout_token;
  const fee = Number(data?.fees);
  const { data: updated, error } = await db
    .from('wallet_transactions')
    .update({
      status: 'completed',
      payout_state: 'sent',
      payout_reference: reference,
      payout_fee: Number.isFinite(fee) ? fee : null,
      payout_error: null,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    // L'argent est parti mais la base n'a pas suivi : on garde « en cours »,
    // le prochain contrôle réessaiera. Surtout pas de nouvel envoi.
    console.error('[payout] Envoi réussi, mise à jour impossible :', row.id, error);
    return 'processing';
  }

  if (!updated?.length) {
    const { data: fresh } = await db.from('wallet_transactions').select('*').eq('id', row.id).maybeSingle();
    if (fresh?.status === 'failed') {
      // Remboursé dans l'Admin alors que l'envoi a finalement réussi : la
      // personne a l'argent deux fois. Un humain doit le voir.
      console.error('[payout] ENVOI RÉUSSI APRÈS REMBOURSEMENT :', row.id);
      await db.from('audit_logs').insert({
        user_id: row.user_id,
        action: 'withdrawal_sent_after_refund',
        details: `Retrait ${row.id} remboursé, mais PayDunya confirme l'envoi de ${fcfa(amountOf(row))} FCFA (réf. ${reference}).`,
        ip: 'paydunya',
        device: 'Serveur',
        status: 'failure',
      });
      await notifyAdmins(db, row, `déjà remboursé, mais PayDunya confirme l'envoi (réf. ${reference}). À régulariser.`);
    }
    return fresh ? stateOf(fresh) : 'sent';
  }

  await notify(
    db,
    row.user_id,
    'Retrait effectué',
    `${fcfa(amountOf(row))} FCFA ont été envoyés sur votre compte ${destinationOf(row)}. Référence : ${reference}.`
  );
  return 'sent';
}

/** Rend la main à l'Admin. Ne vaut que depuis « en cours » : pas de double alerte. */
async function toManual(db: any, row: any, reason: string, clearToken = false): Promise<PayoutState> {
  const { data: updated, error } = await db
    .from('wallet_transactions')
    .update({ payout_state: 'manual', payout_error: reason, ...(clearToken ? { payout_token: null } : {}) })
    .eq('id', row.id)
    .eq('status', 'pending')
    .eq('payout_state', 'processing')
    .select('id');
  if (error) {
    console.error('[payout] Passage en file admin impossible :', row.id, error);
    return 'processing';
  }
  if (updated?.length) {
    await notify(
      db,
      row.user_id,
      'Retrait en cours de traitement',
      `Votre retrait de ${fcfa(amountOf(row))} FCFA vers ${destinationOf(row)} est repris par notre équipe. Votre argent reste réservé.`
    );
    await notifyAdmins(db, row, reason);
  }
  return 'manual';
}

async function settle(db: any, row: any, check: { status: CheckStatus; data: any }, afterSubmit: string | null = null): Promise<PayoutState> {
  switch (check.status) {
    case 'success':
      return markSent(db, row, check.data);
    case 'failed':
      return toManual(db, row, 'PayDunya signale un échec de cet envoi.', true);
    case 'created':
      // « created » = jamais parti chez l'opérateur. Juste après une soumission
      // refusée c'est clair. Sinon la soumission est peut-être en cours dans un
      // autre appel : on laisse deux minutes avant de rendre la main.
      if (afterSubmit !== null) return toManual(db, row, afterSubmit || "PayDunya n'a pas accepté l'envoi.");
      if (startedSecondsAgo(row) > 120) return toManual(db, row, "L'envoi n'a pas été soumis à l'opérateur.");
      return 'processing';
    default:
      return 'processing';
  }
}

async function submitAndSettle(db: any, row: any, token: string): Promise<PayoutState> {
  let detail = '';
  try {
    const submitted = await paydunyaPost(
      'submit-invoice',
      {
        disburse_invoice: token,
        // Notre référence : PayDunya refuse un disburse_id déjà utilisé.
        disburse_id: `${String(row.id).replace(/-/g, '').slice(0, 20)}-${row.payout_attempts}`,
      },
      25000
    );
    if (submitted?.response_code !== '00') detail = String(submitted?.response_text || '');
  } catch (error) {
    // Coupure ou délai dépassé : l'envoi est peut-être parti. check-status tranche.
    console.error('[payout] submit-invoice sans réponse :', row.id, error);
  }
  return settle(db, row, await checkStatus(token), detail);
}

/** La ligne doit déjà être réservée (payout_state = 'processing'). */
async function startPayout(db: any, row: any, callbackUrl: string): Promise<PayoutState> {
  const route = PAYOUT_ROUTES[row.payment_method];
  const alias = route ? toAccountAlias(row.reference, route) : null;
  const amount = amountOf(row);
  if (!route) return toManual(db, row, "Opérateur non pris en charge par l'envoi PayDunya.");
  if (!alias) return toManual(db, row, `Numéro invalide pour ${route.label} : ${row.reference}.`);
  if (!Number.isInteger(amount)) return toManual(db, row, 'Montant avec décimales : PayDunya ne les accepte pas.');

  let invoice: any;
  try {
    invoice = await paydunyaPost(
      'get-invoice',
      { account_alias: alias, amount, withdraw_mode: route.mode, callback_url: callbackUrl },
      15000
    );
  } catch (error) {
    // Rien n'a été soumis : aucun argent n'a pu partir.
    console.error('[payout] get-invoice sans réponse :', row.id, error);
    return toManual(db, row, 'PayDunya ne répond pas.');
  }

  if (invoice?.response_code !== '00' || !invoice?.disburse_token) {
    return toManual(db, row, `PayDunya refuse l'envoi : ${invoice?.response_text || 'réponse inattendue'}.`);
  }

  const token = String(invoice.disburse_token).trim();
  const attempts = Number(row.payout_attempts || 0) + 1;
  const { data: saved, error: saveError } = await db
    .from('wallet_transactions')
    .update({ payout_token: token, payout_attempts: attempts })
    .eq('id', row.id)
    .eq('status', 'pending')
    .eq('payout_state', 'processing')
    .select('*');

  // Sans jeton enregistré, on ne soumet pas : on ne pourrait plus suivre l'envoi.
  if (saveError || !saved?.length) {
    console.error('[payout] Jeton non enregistré, envoi annulé :', row.id, saveError);
    return toManual(db, row, "Enregistrement impossible : l'envoi n'a pas été lancé.");
  }

  return submitAndSettle(db, saved[0], token);
}

async function refresh(db: any, row: any): Promise<PayoutState> {
  if (row.status !== 'pending' || row.payout_state !== 'processing') return stateOf(row);
  if (!row.payout_token) {
    // Réservée mais jamais soumise : la fonction s'est arrêtée avant l'envoi.
    if (startedSecondsAgo(row) > 60) return toManual(db, row, "L'envoi n'a pas démarré.");
    return 'processing';
  }
  return settle(db, row, await checkStatus(row.payout_token));
}

function callbackUrlOf(req: any): string {
  return `https://${req.headers.host}/api/paydunya-payout?action=callback`;
}

interface Eligibility {
  auto: boolean;
  reason?: string;
  defaultPin?: boolean;
}

async function checkEligibility(db: any, row: any): Promise<Eligibility> {
  if (process.env.PAYDUNYA_MODE !== 'live' || !paydunyaConfigured()) {
    return { auto: false, reason: 'Envoi PayDunya non configuré sur ce serveur.' };
  }

  const { data: settings, error: settingsError } = await db
    .from('platform_settings')
    .select('maintenance_mode, auto_withdraw_enabled, auto_withdraw_max_amount, auto_withdraw_daily_max')
    .eq('id', 1)
    .maybeSingle();
  if (settingsError || !settings) return { auto: false, reason: 'Réglages des retraits illisibles.' };
  if (!settings.auto_withdraw_enabled) return { auto: false, reason: 'Envoi automatique désactivé.' };
  if (settings.maintenance_mode) return { auto: false, reason: 'Plateforme en maintenance.' };

  const amount = amountOf(row);
  const maxAmount = Number(settings.auto_withdraw_max_amount);
  if (amount > maxAmount) {
    return { auto: false, reason: `Au-dessus du plafond automatique (${fcfa(maxAmount)} FCFA par retrait).` };
  }

  // Un code resté à 0000 ne protège rien : pas d'envoi sans contrôle humain.
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('security_pin_hash, pin_changed_at')
    .eq('id', row.user_id)
    .maybeSingle();
  if (profileError || !profile) return { auto: false, reason: 'Profil illisible.' };
  if (!profile.security_pin_hash) {
    return { auto: false, reason: 'Code PIN encore à 0000.', defaultPin: true };
  }
  // Un voleur de session commencerait par changer le code : on lui laisse 24 h
  // de moins pour vider le compte, et la personne a été prévenue.
  if (profile.pin_changed_at && Date.now() - new Date(profile.pin_changed_at).getTime() < 24 * 3600 * 1000) {
    return { auto: false, reason: 'Code PIN changé il y a moins de 24 h : à vérifier.' };
  }

  // Ligne déjà insérée : deux demandes simultanées se voient l'une l'autre.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data: today, error: todayError } = await db
    .from('wallet_transactions')
    .select('amount, payout_amount')
    .eq('user_id', row.user_id)
    .eq('type', 'withdraw')
    .neq('status', 'failed')
    .gte('date', startOfDay.toISOString());
  if (todayError) return { auto: false, reason: 'Plafond journalier non vérifiable.' };
  const total = (today || []).reduce((sum: number, line: any) => sum + amountOf(line), 0);
  const dailyMax = Number(settings.auto_withdraw_daily_max);
  if (total > dailyMax) {
    return { auto: false, reason: `Plafond journalier dépassé (${fcfa(dailyMax)} FCFA par jour).` };
  }

  return { auto: true };
}

async function handleRequest(req: any, res: any, db: any) {
  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ success: false, message: 'Authentification requise.' });

  const { idempotencyKey, amount, paymentMethod, phone, pin, feeOnTop, expectedFee } = req.body ?? {};
  const parsedAmount = Number(amount);
  if (!Number.isInteger(parsedAmount) || parsedAmount < MIN_WITHDRAWAL) {
    return res.status(400).json({ success: false, message: `Le retrait minimum est de ${fcfa(MIN_WITHDRAWAL)} FCFA, sans décimales.` });
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) {
    return res.status(400).json({ success: false, message: 'Requête invalide.' });
  }
  const route = PAYOUT_ROUTES[paymentMethod];
  if (!route) return res.status(400).json({ success: false, message: 'Opérateur non pris en charge.' });
  if (!toAccountAlias(phone, route)) {
    return res.status(400).json({ success: false, message: `Numéro invalide pour ${route.label}.` });
  }
  if (typeof pin !== 'string' || !/^[0-9]{4}$/.test(pin)) {
    return res.status(400).json({ success: false, message: 'Veuillez saisir votre code PIN à 4 chiffres.' });
  }

  if (typeof feeOnTop !== 'boolean' || !Number.isFinite(expectedFee) || expectedFee < 0) {
    return res.status(400).json({ success: false, message: 'Requête invalide.' });
  }

  const asCaller = callerClient(req);
  const { data: pinResult, error: pinError } = await asCaller.rpc('verify_user_pin', {
    p_user_id: caller.id,
    p_entered_pin: pin,
  });
  if (pinError) {
    console.error('[payout] Vérification du PIN impossible :', pinError);
    return res.status(500).json({ success: false, message: 'Vérification du code PIN impossible. Réessayez.' });
  }
  if (!pinResult?.ok) {
    return res.status(403).json({ success: false, message: pinResult?.message || 'Code PIN incorrect.' });
  }

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  // Le code PIN vient d'être vérifié : seul ce serveur a le droit de débiter
  // (migration 0038). Sans cela, une session volée suffirait à déposer une demande.
  let { data: debit, error: debitError } = await db.rpc('request_wallet_withdrawal_for', {
    p_user_id: caller.id,
    p_idempotency_key: idempotencyKey,
    p_amount: parsedAmount,
    p_payment_method: paymentMethod,
    p_phone: phone,
    p_method_label: route.label,
    p_ip: forwarded || null,
    p_fee_on_top: feeOnTop,
    p_expected_fee: expectedFee,
  });
  // Migrations pas encore appliquées : même retrait par les anciennes fonctions.
  if (debitError?.code === 'PGRST202') {
    const debitArgs = {
      p_idempotency_key: idempotencyKey,
      p_amount: parsedAmount,
      p_payment_method: paymentMethod,
      p_phone: phone,
      p_method_label: route.label,
      p_ip: forwarded || null,
    };
    ({ data: debit, error: debitError } = await asCaller.rpc('request_wallet_withdrawal', {
      ...debitArgs,
      p_fee_on_top: feeOnTop,
      p_expected_fee: expectedFee,
    }));
    if (debitError?.code === 'PGRST202') {
      ({ data: debit, error: debitError } = await asCaller.rpc('request_wallet_withdrawal', debitArgs));
    }
  }
  if (debitError) {
    console.error('[payout] Débit impossible :', debitError);
    // Coupure possible après le débit : on n'affirme rien. La clé d'idempotence
    // rend le nouvel essai sans danger.
    return res.status(500).json({ success: false, message: 'Le retrait n’a pas abouti. Vérifiez votre historique avant de réessayer.' });
  }
  if (!debit?.success) {
    return res.status(400).json({ success: false, message: debit?.message || 'Retrait refusé.' });
  }

  // Migration 0036 pas encore appliquée : le débit est fait, la demande est
  // dans la file de l'Admin comme avant.
  if (!debit.withdrawalId) {
    return res.status(200).json({ success: true, state: 'manual', amount: parsedAmount, debited: parsedAmount, fee: 0 });
  }

  const { data: row, error: rowError } = await db
    .from('wallet_transactions')
    .select('*')
    .eq('id', debit.withdrawalId)
    .eq('user_id', caller.id)
    .eq('type', 'withdraw')
    .maybeSingle();
  if (rowError || !row) {
    console.error('[payout] Demande introuvable après débit :', debit.withdrawalId, rowError);
    return res.status(200).json({ success: true, state: 'manual', amount: parsedAmount, debited: parsedAmount, fee: 0, withdrawalId: debit.withdrawalId });
  }

  const reply = (state: PayoutState, extra: object = {}) =>
    res.status(200).json({
      success: true,
      state,
      amount: amountOf(row),
      debited: debitOf(row),
      fee: Number(row.withdraw_fee ?? 0),
      withdrawalId: row.id,
      ...extra,
    });

  const debitNotice = () => {
    const fee = Number(row.withdraw_fee ?? 0);
    return `${fcfa(debitOf(row))} FCFA ont été débités de votre portefeuille`
      + (fee > 0 ? ` (dont ${fcfa(fee)} FCFA de frais)` : '')
      + ` pour un envoi de ${fcfa(amountOf(row))} FCFA vers ${destinationOf(row)}.`;
  };

  // Même clé rejouée, décision déjà prise : on donne l'état, sans rien renvoyer.
  if (row.payout_state !== null) return reply(await refresh(db, row));

  const eligibility = await checkEligibility(db, row);

  if (!eligibility.auto) {
    const { data: queued, error: queueError } = await db
      .from('wallet_transactions')
      .update({ payout_state: 'manual', payout_error: eligibility.reason })
      .eq('id', row.id)
      .eq('status', 'pending')
      .is('payout_state', null)
      .select('id');
    if (queueError) console.error('[payout] Mise en file impossible :', row.id, queueError);
    if (queued?.length) {
      await notify(
        db,
        row.user_id,
        'Retrait en cours de traitement',
        `${debitNotice()} Notre équipe finalise cet envoi.`
      );
      await notifyAdmins(db, row, eligibility.reason || 'à traiter.');
    }
    return reply('manual', { defaultPin: Boolean(eligibility.defaultPin) });
  }

  const { data: claimed, error: claimError } = await db
    .from('wallet_transactions')
    .update({ payout_state: 'processing', payout_started_at: new Date().toISOString(), payout_error: null })
    .eq('id', row.id)
    .eq('status', 'pending')
    .is('payout_state', null)
    .select('*');
  if (claimError) {
    console.error('[payout] Réservation impossible :', row.id, claimError);
    return reply('manual');
  }
  // Un autre appel a pris la main : lui seul envoie.
  if (!claimed?.length) return reply('processing');

  await notify(
    db,
    row.user_id,
    'Retrait en cours',
    debitNotice()
  );

  return reply(await startPayout(db, claimed[0], callbackUrlOf(req)));
}

async function isAdmin(req: any): Promise<boolean> {
  const { data, error } = await callerClient(req).rpc('is_admin');
  return !error && data === true;
}

async function handleStatus(req: any, res: any, db: any) {
  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ success: false, message: 'Authentification requise.' });

  const withdrawalId = req.body?.withdrawalId;
  if (typeof withdrawalId !== 'string') return res.status(400).json({ success: false, message: 'Requête invalide.' });

  const { data: row, error } = await db
    .from('wallet_transactions')
    .select('*')
    .eq('id', withdrawalId)
    .eq('type', 'withdraw')
    .maybeSingle();
  if (error || !row) return res.status(404).json({ success: false, message: 'Retrait introuvable.' });
  if (row.user_id !== caller.id && !(await isAdmin(req))) {
    return res.status(403).json({ success: false, message: 'Action non autorisée.' });
  }

  return res.status(200).json({ success: true, state: await refresh(db, row), error: row.payout_error ?? null });
}

/** Admin : lance ou relance l'envoi d'un retrait de la file. */
async function handleSend(req: any, res: any, db: any) {
  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ success: false, message: 'Authentification requise.' });
  if (!(await isAdmin(req))) return res.status(403).json({ success: false, message: 'Action réservée aux administrateurs.' });
  if (process.env.PAYDUNYA_MODE !== 'live' || !paydunyaConfigured()) {
    return res.status(503).json({ success: false, message: 'Envoi PayDunya non configuré sur ce serveur.' });
  }

  const withdrawalId = req.body?.withdrawalId;
  if (typeof withdrawalId !== 'string') return res.status(400).json({ success: false, message: 'Requête invalide.' });

  const { data: claimed, error: claimError } = await db
    .from('wallet_transactions')
    .update({ payout_state: 'processing', payout_started_at: new Date().toISOString(), payout_error: null })
    .eq('id', withdrawalId)
    .eq('type', 'withdraw')
    .eq('status', 'pending')
    .or('payout_state.is.null,payout_state.eq.manual')
    .select('*');
  if (claimError) {
    console.error('[payout] Réservation admin impossible :', withdrawalId, claimError);
    return res.status(500).json({ success: false, message: 'Réservation du retrait impossible.' });
  }

  if (!claimed?.length) {
    const { data: row } = await db.from('wallet_transactions').select('*').eq('id', withdrawalId).maybeSingle();
    if (!row) return res.status(404).json({ success: false, message: 'Retrait introuvable.' });
    return res.status(200).json({ success: true, state: await refresh(db, row) });
  }

  const row = claimed[0];
  let state: PayoutState;
  if (row.payout_token) {
    // Une tentative existe déjà : on regarde son issue avant de renvoyer quoi que ce soit.
    const check = await checkStatus(row.payout_token);
    if (check.status === 'created') state = await submitAndSettle(db, row, row.payout_token);
    else if (check.status === 'failed') state = await startPayout(db, { ...row, payout_token: null }, callbackUrlOf(req));
    else if (check.status === 'unknown') state = await toManual(db, row, "Statut de l'envoi précédent invérifiable : aucun nouvel envoi lancé.");
    else state = await settle(db, row, check);
  } else {
    state = await startPayout(db, row, callbackUrlOf(req));
  }

  const { data: fresh } = await db.from('wallet_transactions').select('payout_error').eq('id', row.id).maybeSingle();
  return res.status(200).json({ success: true, state, error: fresh?.payout_error ?? null });
}

/**
 * Notification de PayDunya. Comme pour les dépôts, le corps reçu n'est pas cru :
 * on en garde le jeton, et on demande nous-mêmes l'issue à PayDunya.
 */
async function handleCallback(req: any, res: any, db: any) {
  let body = req.body ?? {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const token = String(body?.token || body?.data?.token || body?.disburse_invoice || '').trim();
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const { data: row, error } = await db
    .from('wallet_transactions')
    .select('*')
    .eq('payout_token', token)
    .eq('type', 'withdraw')
    .maybeSingle();
  if (error) {
    console.error('[payout] Callback : lecture impossible :', error);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (!row) return res.status(200).json({ received: true, matched: false });
  if (row.status === 'completed') return res.status(200).json({ received: true, state: 'sent' });

  const state = await settle(db, row, await checkStatus(token));
  return res.status(200).json({ received: true, state });
}

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const action = req.query?.action;

  // PayDunya refuse un callback « non accessible » : on répond aussi au GET.
  if (action === 'callback' && req.method === 'GET') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const db = serviceClient();
  if (!db) {
    console.error('[payout] SUPABASE_SERVICE_ROLE_KEY absent.');
    return res.status(503).json({ success: false, message: 'Le retrait est momentanément indisponible.' });
  }

  try {
    if (action === 'request') return await handleRequest(req, res, db);
    if (action === 'status') return await handleStatus(req, res, db);
    if (action === 'send') return await handleSend(req, res, db);
    if (action === 'callback') return await handleCallback(req, res, db);
    return res.status(400).json({ success: false, message: 'Action inconnue.' });
  } catch (error) {
    console.error('[payout] Erreur inattendue :', action, error);
    return res.status(500).json({ success: false, message: 'Une erreur est survenue. Vérifiez votre historique avant de réessayer.' });
  }
}
