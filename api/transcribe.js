import { OpenAI } from 'openai';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if file exists in the request
    if (!req.body || !req.body.audio) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Extract audio data and language from request
    const audioData = req.body.audio;
    const language = req.body.language || null;

    // Create a temporary file
    const tempFilePath = join(tmpdir(), `whisper-${Date.now()}.webm`);
    
    // Convert base64 audio data to buffer if needed
    const audioBuffer = Buffer.from(audioData, 'base64');
    await fs.writeFile(tempFilePath, audioBuffer);

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
      language: language ? language.split('-')[0] : undefined, // Whisper expects language codes without region
      response_format: "json"
    });

    // Clean up temporary file
    await fs.unlink(tempFilePath);

    // Return transcription result
    res.status(200).json({
      text: transcription.text,
      language: transcription.language || language || 'en' // Fallback to English if not detected
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
}
