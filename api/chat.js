import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://language-tutor-opal.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, language, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const messages = [
      {
        role: "system",
        content: `You are Language Tutor Pro, an AI language teaching assistant. Respond in ${language || 'English'}.`
      },
      ...(history || []),
      { role: "user", content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7,
    });

    return res.status(200).json({ 
      response: completion.choices[0]?.message?.content 
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
