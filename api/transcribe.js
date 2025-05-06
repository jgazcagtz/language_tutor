import { OpenAI } from 'openai';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';
import { IncomingForm } from 'formidable';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
};

export default async function handler(req, res) {
  // Set CORS headers (same as chat.js)
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
    const form = new IncomingForm();
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    // Validate input
    if (!files?.audio?.[0]) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioFile = files.audio[0];
    const language = fields.language?.[0] || null;

    // Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.filepath),
      model: "whisper-1",
      language: language ? language.split('-')[0] : undefined, // Convert en-US → en
      response_format: "json"
    });

    // Clean up temporary file
    await fs.unlink(audioFile.filepath);

    return res.status(200).json({
      text: transcription.text,
      language: transcription.language || language || 'en' // Fallback
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
