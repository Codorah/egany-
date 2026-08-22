export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'to et message sont requis.' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken || !fromWhatsApp) {
      console.log('WhatsApp notification skipped: Twilio not configured.');
      return res.status(200).json({ sent: false, reason: 'not_configured' });
    }

    const body = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: fromWhatsApp.startsWith('whatsapp:') ? fromWhatsApp : `whatsapp:${fromWhatsApp}`,
      Body: message,
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody);
    }

    res.status(200).json({ sent: true });
  } catch (error: any) {
    console.error('WhatsApp notification error:', error);
    res.status(200).json({ sent: false, reason: error.message });
  }
}
