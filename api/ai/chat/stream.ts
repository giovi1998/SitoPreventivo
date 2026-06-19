// @ts-nocheck
export default async function handler(req, res) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    res.status(503).json({ error: "DeepSeek non configurato. Imposta DEEPSEEK_API_KEY nelle variabili d'ambiente su Vercel." });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { model, messages, tools, temperature, max_tokens } = req.body;

  const body = {
    model: model || 'deepseek-chat',
    messages,
    stream: true,
    ...(tools ? { tools } : {}),
    ...(temperature !== undefined ? { temperature } : { temperature: 0.7 }),
    ...(max_tokens ? { max_tokens } : {}),
  };

  try {
    const apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => "Unknown");
      if (apiRes.status === 402) return res.status(402).json({ error: 'Credito DeepSeek esaurito' });
      if (apiRes.status === 401) return res.status(401).json({ error: 'Chiave API DeepSeek non valida' });
      if (apiRes.status === 429) return res.status(429).json({ error: 'Troppe richieste. Attendi e riprova.' });
      return res.status(apiRes.status).json({ error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` });
    }

    const contentType = apiRes.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const data = await apiRes.json();
      return res.status(200).json(data);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } catch (err) {
      console.error('[Stream] Errore durante lo streaming:', err.message);
      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (err) {
    console.error('[Stream] Errore di connessione:', err.message);
    res.status(504).json({ error: `Connessione fallita: ${err.message}` });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
