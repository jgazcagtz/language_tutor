const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Initialize OpenAI with your API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Chat endpoint
module.exports.chatHandler = async (req, res) => {
    try {
        const { message, language, history } = req.body;
        
        // Update system prompt based on selected language
        let systemPrompt = `You are Language Tutor Pro, an AI language teaching assistant specializing in English, Spanish, French, German, and Portuguese. Respond in the same language as the user's input.`;
        
        if (language && language !== 'auto') {
            const langMap = {
                'en-US': 'English',
                'es-ES': 'Spanish',
                'fr-FR': 'French',
                'de-DE': 'German',
                'pt-PT': 'Portuguese'
            };
            systemPrompt = `You are Language Tutor Pro, teaching ${langMap[language]}. Respond in ${langMap[language]} unless the user requests otherwise.`;
        }
        
        // Prepare messages for OpenAI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6) // Keep last 6 messages for context
        ];
        
        if (message) {
            messages.push({ role: 'user', content: message });
        }
        
        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages,
            temperature: 0.7,
            max_tokens: 500,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        });
        
        const response = completion.choices[0]?.message?.content || "I didn't get a response. Please try again.";
        
        res.json({ response });
        
    } catch (error) {
        console.error('Error in chatHandler:', error);
        res.status(500).json({ error: error.message });
    }
};

// Transcription endpoint (using OpenAI Whisper)
module.exports.transcribeHandler = async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No audio file uploaded');
        }
        
        const { language } = req.body;
        
        // Save the file temporarily
        const tempFilePath = path.join('/tmp', `audio-${Date.now()}.webm`);
        await fs.promises.writeFile(tempFilePath, req.file.buffer);
        
        // Transcribe with OpenAI Whisper
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: language === 'auto' ? undefined : language?.split('-')[0],
            response_format: "json"
        });
        
        // Clean up
        await fs.promises.unlink(tempFilePath);
        
        res.json({
            text: transcription.text,
            language: transcription.language
        });
        
    } catch (error) {
        console.error('Error in transcribeHandler:', error);
        res.status(500).json({ error: error.message });
    }
};
