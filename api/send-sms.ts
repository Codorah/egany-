import { createClient } from '@supabase/supabase-js';
import { requireUserOr401 } from './_requireUser';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Relais fermé : sans ce contrôle, n'importe qui sur Internet pouvait
    // faire envoyer des messages sur les comptes d'eganyé (voir _requireUser).
    const caller = await requireUserOr401(req, res);
    if (!caller) return;

    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'to et message sont requis.' });
    }

    // Même authentifié, rien n'empêchait d'envoyer vers n'importe quel
    // numéro : un compte créé pour l'occasion pouvait spammer des tiers sur
    // le crédit Africa's Talking d'eganyé. On ne relaie plus que vers le
    // numéro réellement enregistré sur le compte de l'appelant.
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(503).json({ error: 'Service indisponible.' });
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', caller.id)
      .single();
    if (!profile?.phone || profile.phone !== to) {
      return res.status(403).json({ error: 'Destinataire non autorisé.' });
    }

    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const username = process.env.AFRICASTALKING_USERNAME;
    const senderId = process.env.AFRICASTALKING_SENDER_ID;

    if (!apiKey || !username) {
      console.log('SMS notification skipped: Africa\'s Talking not configured.');
      return res.status(200).json({ sent: false, reason: 'not_configured' });
    }

    const body = new URLSearchParams({
      username,
      to,
      message,
      ...(senderId ? { from: senderId } : {}),
    });

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        apiKey,
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody);
    }

    const data = await response.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.status !== 'Success') {
      throw new Error(recipient.status || 'Échec d\'envoi SMS');
    }

    res.status(200).json({ sent: true });
  } catch (error: any) {
    console.error('SMS notification error:', error);
    res.status(200).json({ sent: false, reason: error.message });
  }
}
