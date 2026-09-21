import { createClient } from '@supabase/supabase-js';
import { requireUserOr401 } from './_requireUser';

/**
 * Enregistre une notification et la relaie sur les canaux choisis par la
 * destinataire.
 *
 * POURQUOI CÔTÉ SERVEUR
 * ---------------------
 * L'envoi se faisait depuis le navigateur : pour prévenir quelqu'un, le code
 * lisait son adresse e-mail et son téléphone dans la table `profiles`. Cela
 * n'était possible que parce que la table entière était lisible par toute
 * personne connectée — soit, dans un produit où des inconnues se retrouvent
 * dans un même cercle, un annuaire ouvert. Depuis la migration 0012, les
 * profils ne sont lisibles que par leur propriétaire ; les coordonnées ne
 * sont donc plus résolues qu'ici, avec la clé de service.
 *
 * QUI A LE DROIT D'ÉCRIRE À QUI
 * -----------------------------
 * La question n'est pas tranchée par ce fichier : l'insertion est tentée avec
 * le jeton de l'appelante, donc sous les règles RLS de la base
 * (`notifications_insert_self_or_co_member`, migration 0011). Écrire à
 * soi-même, à une co-membre d'un cercle ou en tant qu'administratrice passe ;
 * tout le reste est refusé par Postgres, pas par une condition écrite ici que
 * l'on pourrait oublier de mettre à jour.
 *
 * C'est aussi ce qui empêche cet endpoint de devenir un énumérateur : on ne
 * peut pas s'en servir pour arroser des identifiants au hasard.
 */

type Channel = 'email' | 'sms' | 'whatsapp';

async function deliverEmail(to: string, subject: string, message: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // Même valeur de repli que api/send-email.ts, pour que les deux chemins
  // envoient depuis la même adresse.
  const from = process.env.RESEND_FROM_EMAIL || 'eganye@resend.dev';
  if (!apiKey) return;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: `<p>${message}</p>`,
    }),
  });
}

async function deliverSms(to: string, message: string): Promise<void> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  const senderId = process.env.AFRICASTALKING_SENDER_ID;
  if (!apiKey || !username) return;

  await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      apiKey,
    },
    body: new URLSearchParams({
      username,
      to,
      message,
      ...(senderId ? { from: senderId } : {}),
    }),
  });
}

async function deliverWhatsApp(to: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !fromWhatsApp) return;

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      From: fromWhatsApp,
      To: `whatsapp:${to}`,
      Body: message,
    }),
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const caller = await requireUserOr401(req, res);
  if (!caller) return;

  const { userId, title, message, type, link } = req.body ?? {};
  if (!userId || !title || !message || !type) {
    return res.status(400).json({ error: 'Requête incomplète.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('[notify] Configuration Supabase incomplète.');
    return res.status(503).json({ error: 'Service indisponible.' });
  }

  const accessToken = (req.headers?.authorization || '').slice('Bearer '.length).trim();

  try {
    // ---- 1. L'insertion, sous l'identité de l'appelante : c'est RLS qui
    //         décide si elle a le droit d'écrire à cette personne. ----
    const asCaller = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { error: insertError } = await asCaller.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      read: false,
      ...(link ? { link } : {}),
    });

    if (insertError) {
      console.warn('[notify] Insertion refusée :', insertError.message);
      return res.status(403).json({ error: 'Envoi non autorisé vers ce destinataire.' });
    }

    // ---- 2. Les coordonnées, avec la clé de service. Elles ne quittent
    //         jamais ce fichier. ----
    const asService = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await asService
      .from('profiles')
      .select('email, phone, email_notifications_enabled, sms_notifications_enabled, whatsapp_notifications_enabled')
      .eq('id', userId)
      .single();

    if (!profile) return res.status(200).json({ recorded: true, delivered: [] });

    const delivered: Channel[] = [];
    const deliveries: Promise<void>[] = [];

    if (profile.email_notifications_enabled && profile.email) {
      delivered.push('email');
      deliveries.push(deliverEmail(profile.email, title, message));
    }
    if (profile.sms_notifications_enabled && profile.phone) {
      delivered.push('sms');
      deliveries.push(deliverSms(profile.phone, `${title} - ${message}`));
    }
    if (profile.whatsapp_notifications_enabled && profile.phone) {
      delivered.push('whatsapp');
      deliveries.push(deliverWhatsApp(profile.phone, `${title} - ${message}`));
    }

    // L'échec d'un canal ne doit pas faire échouer la notification : elle est
    // déjà enregistrée dans l'application, qui reste la source de vérité.
    await Promise.allSettled(deliveries);

    return res.status(200).json({ recorded: true, delivered });
  } catch (err: any) {
    console.error('[notify] Erreur inattendue :', err);
    return res.status(500).json({ error: 'Notification impossible.' });
  }
}
