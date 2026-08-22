export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'to et message sont requis.' });
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
