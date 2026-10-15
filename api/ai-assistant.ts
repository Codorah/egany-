import { createClient } from '@supabase/supabase-js';
import { requireUserOr401 } from './_requireUser';

import Anthropic from '@anthropic-ai/sdk';

// Limites par personne (migration 0022) et tailles maximales : chaque appel
// est facturé à eganyé, et le contexte est envoyé par le navigateur.
const MAX_PER_HOUR = 20;
const MAX_PER_DAY = 60;
const MAX_MESSAGE_CHARS = 1000;
const MAX_CONTEXT_CHARS = 12000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Relais fermé : sans ce contrôle, n'importe qui sur Internet pouvait
    // faire envoyer des messages sur les comptes d'eganyé (voir _requireUser).
    const user = await requireUserOr401(req, res);
    if (!user) return;

    const { message, context } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message est requis.' });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ error: `Question trop longue (${MAX_MESSAGE_CHARS} caractères maximum).` });
    }
    const contextJson = JSON.stringify(context ?? {}, null, 2);
    if (contextJson.length > MAX_CONTEXT_CHARS) {
      return res.status(413).json({ error: 'Données envoyées trop volumineuses.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        reply: "L'assistant IA n'est pas encore configuré. Contactez l'administrateur.",
        configured: false,
      });
    }

    // Quota consommé AVANT l'appel payant. En cas de doute (base
    // injoignable, migration absente), on refuse : mieux vaut un assistant
    // indisponible qu'une facture sans plafond.
    const quotaClient = createClient(
      (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: quota, error: quotaError } = await quotaClient.rpc('consume_ai_quota', {
      p_user_id: user.id,
      p_per_hour: MAX_PER_HOUR,
      p_per_day: MAX_PER_DAY,
    });
    if (quotaError || !quota) {
      console.error('[ai-assistant] Quota indisponible :', quotaError);
      return res.status(503).json({ reply: "L'assistant est momentanément indisponible. Réessayez plus tard.", configured: true });
    }
    if (!(quota as any).allowed) {
      const reply = (quota as any).reason === 'hour'
        ? `Vous avez posé ${MAX_PER_HOUR} questions cette dernière heure. Réessayez un peu plus tard.`
        : `Vous avez atteint la limite de ${MAX_PER_DAY} questions pour aujourd'hui. Revenez demain.`;
      return res.status(429).json({ reply, configured: true, limited: true });
    }

    const client = new Anthropic({ apiKey });

    const systemPrompt = `Tu es le Copilote IA d'Eganyé, une application de tontine (cercle d'épargne rotative) pour l'Afrique de l'Ouest. Tu réponds en français, de façon brève et concrète (quelques phrases, pas de longs paragraphes), à des questions sur la trésorerie, les cotisations et les cercles de l'utilisateur.

Utilise UNIQUEMENT les données réelles ci-dessous pour répondre. Ne jamais inventer un chiffre, un nom de cercle ou un montant qui n'est pas dans ces données. Si l'information demandée n'y figure pas, dis-le clairement plutôt que de deviner.

Tu peux suggérer le texte d'un message de rappel à envoyer à un membre en retard, mais tu ne peux pas l'envoyer toi-même — précise-le si on te le demande.

Données réelles de l'utilisateur :
${contextJson}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    res.status(200).json({ reply: textBlock?.text ?? '', configured: true });
  } catch (error: any) {
    console.error('AI assistant error:', error);
    res.status(200).json({
      reply: "Une erreur est survenue, réessayez dans un instant.",
      configured: true,
    });
  }
}
