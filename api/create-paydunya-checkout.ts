export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, userId, userName, userEmail } = req.body;

    const masterKey = process.env.PAYDUNYA_MASTER_KEY;
    const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
    const token = process.env.PAYDUNYA_TOKEN;
    const mode = process.env.PAYDUNYA_MODE || 'sandbox';

    const origin = req.headers.origin || 'https://egany.vercel.app';

    // Check if credentials are set
    if (!masterKey || !privateKey || !token) {
      console.log("Paydunya credentials not fully set, falling back to simulated checkout interface.");
      // Simulated sandbox redirect link
      const simUrl = `${origin}/?paydunya_sim=true&amount=${amount}&userId=${userId}&userName=${encodeURIComponent(userName)}&userEmail=${encodeURIComponent(userEmail || '')}`;
      return res.status(200).json({ id: 'sim_session_id', url: simUrl });
    }

    // Real Paydunya integration if keys exist
    const baseUrl = mode === 'live' 
      ? 'https://app.paydunya.com/api/v1/checkout-invoice/create' 
      : 'https://sandbox.paydunya.com/api/v1/checkout-invoice/create';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': masterKey,
        'PAYDUNYA-PRIVATE-KEY': privateKey,
        'PAYDUNYA-TOKEN': token,
      },
      body: JSON.stringify({
        invoice: {
          total_amount: amount,
          description: "Recharge de Portefeuille Virtuel Tontine Connect",
          name: "Tontine Connect Top-up"
        },
        store: {
          name: "Tontine Connect"
        },
        actions: {
          cancel_url: `${origin}/?payment=cancel`,
          return_url: `${origin}/?payment=success&paydunya_ref=recharge&amount=${amount}&userId=${userId}`
        },
        custom_data: {
          userId,
          userName,
          userEmail,
          amount
        }
      })
    });

    const data = await response.json();
    
    // CORRECTION: response_text contains the URL of the invoice, not 'success'
    if (data.response_code === '00') {
      res.status(200).json({ id: data.token, url: data.response_text });
    } else {
      throw new Error(data.response_text || "Erreur de réponse de l'API Paydunya");
    }
  } catch (error: any) {
    console.error('Paydunya error:', error);
    res.status(500).json({ error: error.message });
  }
}
