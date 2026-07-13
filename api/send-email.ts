export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, message } = req.body;
    if (!to || !subject || !message) {
      return res.status(400).json({ error: 'to, subject et message sont requis.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'eganye@resend.dev';
    
    if (!apiKey) {
      console.log('Email notification skipped: RESEND_API_KEY not configured.');
      return res.status(200).json({ sent: false, reason: 'not_configured' });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html: `<p>${message}</p>`
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody);
    }
    
    res.status(200).json({ sent: true });
  } catch (error: any) {
    console.error('Email notification error:', error);
    res.status(200).json({ sent: false, reason: error.message });
  }
}
