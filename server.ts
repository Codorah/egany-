import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

dotenv.config();

// Firebase Admin SDK, used to send push notifications via FCM. Only
// initialized when a service account key is actually configured -
// push sending stays a documented no-op otherwise (see /api/send-push).
let firebaseAdminApp: App | null = null;
function getFirebaseAdminApp(): App | null {
  if (firebaseAdminApp) return firebaseAdminApp;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) return null;
  try {
    const credentials = JSON.parse(serviceAccountJson);
    firebaseAdminApp = initializeApp({ credential: cert(credentials) });
    return firebaseAdminApp;
  } catch (error) {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON, push notifications disabled:', error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Push Notification Route (Firebase Cloud Messaging)
  app.post('/api/send-push', async (req, res) => {
    try {
      const { token, title, message } = req.body;
      if (!token || !title || !message) {
        return res.status(400).json({ error: 'token, title et message sont requis.' });
      }

      const adminApp = getFirebaseAdminApp();
      if (!adminApp) {
        console.log('Push notification skipped: FIREBASE_SERVICE_ACCOUNT_JSON not configured.');
        return res.status(200).json({ sent: false, reason: 'not_configured' });
      }

      await getMessaging(adminApp).send({
        token,
        notification: { title, body: message }
      });
      res.json({ sent: true });
    } catch (error: any) {
      console.error('Push notification error:', error);
      // Never fail the caller's flow over a push delivery issue.
      res.status(200).json({ sent: false, reason: error.message });
    }
  });

  // Transactional Email Route (Resend)
  app.post('/api/send-email', async (req, res) => {
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
      res.json({ sent: true });
    } catch (error: any) {
      console.error('Email notification error:', error);
      res.status(200).json({ sent: false, reason: error.message });
    }
  });

  // Paydunya Checkout Route (Recharge Portefeuille Virtuel)
  app.post('/api/create-paydunya-checkout', async (req, res) => {
    try {
      const { amount, userId, userName, userEmail } = req.body;

      const masterKey = process.env.PAYDUNYA_MASTER_KEY;
      const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
      const token = process.env.PAYDUNYA_TOKEN;
      const mode = process.env.PAYDUNYA_MODE || 'sandbox';

      const origin = req.headers.origin || 'http://localhost:3000';

      // Check if credentials are set
      if (!masterKey || !privateKey || !token) {
        console.log("Paydunya credentials not fully set, falling back to simulated checkout interface.");
        // Simulated sandbox redirect link pointing to local page
        const simUrl = `${origin}/?paydunya_sim=true&amount=${amount}&userId=${userId}&userName=${encodeURIComponent(userName)}&userEmail=${encodeURIComponent(userEmail || '')}`;
        return res.json({ id: 'sim_session_id', url: simUrl });
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
      if (data.response_code === '00' && data.response_text === 'success') {
        res.json({ id: data.token, url: data.response_text });
      } else {
        throw new Error(data.response_text || "Erreur de réponse de l'API Paydunya");
      }
    } catch (error: any) {
      console.error('Paydunya error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
