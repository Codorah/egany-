import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, context } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message est requis.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        reply: "L'assistant IA n'est pas encore configuré. Contactez l'administrateur.",
        configured: false,
      });
    }

    const client = new Anthropic({ apiKey });

    const systemPrompt = `Tu es le Copilote IA d'Eganyé, une application de tontine (cercle d'épargne rotative) pour l'Afrique de l'Ouest. Tu réponds en français, de façon brève et concrète (quelques phrases, pas de longs paragraphes), à des questions sur la trésorerie, les cotisations et les cercles de l'utilisateur.

Utilise UNIQUEMENT les données réelles ci-dessous pour répondre. Ne jamais inventer un chiffre, un nom de cercle ou un montant qui n'est pas dans ces données. Si l'information demandée n'y figure pas, dis-le clairement plutôt que de deviner.

Tu peux suggérer le texte d'un message de rappel à envoyer à un membre en retard, mais tu ne peux pas l'envoyer toi-même — précise-le si on te le demande.

Données réelles de l'utilisateur :
${JSON.stringify(context ?? {}, null, 2)}`;

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
      error: error.message,
    });
  }
}
