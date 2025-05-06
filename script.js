// DOM Elements
const chatLog = document.getElementById('chat-log');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const languageSelect = document.getElementById('language-select');
const typingIndicator = document.getElementById('typing-indicator');

// State variables
let isListening = false;
let mediaRecorder;
let audioChunks = [];
let conversationHistory = [
    {
        role: "system",
        content: "You are Language Tutor Pro, an AI language teaching assistant specializing in English, Spanish, French, German, and Portuguese. Your role is to help users learn and practice these languages through conversation, explanations, and exercises. Respond in the same language as the user's input, adjusting complexity based on their level. Provide clear explanations, examples, and corrections when needed. Keep responses concise but informative, and maintain a friendly, encouraging tone."
    }
];

// Initialize the chat with a welcome message if empty
function initializeChat() {
    if (chatLog.children.length <= 1) { // Only the welcome message exists
        addMessage('bot', 'Hello! How can I assist you with your language learning today? You can ask questions, practice conversations, or request explanations in English, Spanish, French, German, or Portuguese.');
    }
}

// Add a message to the chat log
function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add(`${sender}-message`, 'message');
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    messageContent.innerHTML = formatMessageContent(content);
    
    const messageMeta = document.createElement('div');
    messageMeta.classList.add('message-meta');
    
    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = getCurrentTime();
    
    messageMeta.appendChild(timestamp);
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageMeta);
    
    chatLog.appendChild(messageDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
    
    // Add to conversation history
    if (sender === 'user') {
        conversationHistory.push({ role: 'user', content });
    }
}

// Format message content (markdown, links, etc.)
function formatMessageContent(content) {
    // Simple formatting for demonstration
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`(.*?)`/g, '<code>$1</code>') // Code
        .replace(/\n/g, '<br>'); // New lines
}

// Get current time in HH:MM format
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Show typing indicator
function showTypingIndicator() {
    typingIndicator.classList.add('active');
    chatLog.scrollTop = chatLog.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    typingIndicator.classList.remove('active');
}

// Send message to the backend
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage('user', message);
    userInput.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Get the selected language
        const language = languageSelect.value;
        
        // Call the backend API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                language,
                history: conversationHistory
            })
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add bot response to chat
        if (data.response) {
            addMessage('bot', data.response);
            conversationHistory.push({ role: 'assistant', content: data.response });
        }
        
        // Speak the response if it's not too long
        if (data.response && data.response.length < 300) {
            speakText(data.response, language === 'auto' ? undefined : language);
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('bot', `Sorry, I encountered an error: ${error.message}`);
        console.error('Error:', error);
    }
}

// Voice Recognition with OpenAI Whisper
async function toggleVoiceRecognition() {
    if (isListening) {
        stopVoiceRecognition();
    } else {
        await startVoiceRecognition();
    }
}

async function startVoiceRecognition() {
    try {
        if (!navigator.mediaDevices) {
            throw new Error('Media devices not available');
        }
        
        micButton.classList.add('listening');
        isListening = true;
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processAudio(audioBlob);
        };
        
        mediaRecorder.start();
        
        // Auto-stop after 30 seconds if not stopped manually
        setTimeout(() => {
            if (isListening) {
                stopVoiceRecognition();
            }
        }, 30000);
        
    } catch (error) {
        console.error('Error starting voice recognition:', error);
        addMessage('bot', `Voice input error: ${error.message}`);
        stopVoiceRecognition();
    }
}

function stopVoiceRecognition() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    micButton.classList.remove('listening');
    isListening = false;
}

async function processAudio(audioBlob) {
    try {
        showTypingIndicator();
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', languageSelect.value);
        
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Transcription failed');
        }
        
        const data = await response.json();
        
        if (data.text) {
            // Auto-detect language if set to auto
            if (languageSelect.value === 'auto' && data.language) {
                const langMap = {
                    'en': 'en-US',
                    'es': 'es-ES',
                    'fr': 'fr-FR',
                    'de': 'de-DE',
                    'pt': 'pt-PT'
                };
                
                if (langMap[data.language]) {
                    languageSelect.value = langMap[data.language];
                }
            }
            
            // Add the transcribed message to chat
            userInput.value = data.text;
            sendMessage();
        } else {
            addMessage('bot', "I couldn't understand what you said. Please try again.");
        }
        
    } catch (error) {
        console.error('Error processing audio:', error);
        addMessage('bot', `Error processing voice input: ${error.message}`);
    } finally {
        hideTypingIndicator();
    }
}

// Text-to-Speech
function speakText(text, lang) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (lang) {
            utterance.lang = lang;
        } else {
            // Auto-detect language from text (simplified)
            if (text.match(/[áéíóúñ]/i)) utterance.lang = 'es-ES';
            else if (text.match(/[àâäçéèêëîïôöùûüÿ]/i)) utterance.lang = 'fr-FR';
            else if (text.match(/[äöüß]/i)) utterance.lang = 'de-DE';
            else if (text.match(/[ãâáàçéêíóôõú]/i)) utterance.lang = 'pt-PT';
            else utterance.lang = 'en-US';
        }
        
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        speechSynthesis.speak(utterance);
    }
}

// Modal functions
function openTutorial() {
    document.getElementById('tutorial-modal').classList.add('show');
}

function closeTutorial() {
    document.getElementById('tutorial-modal').classList.remove('show');
}

// Event Listeners
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);
micButton.addEventListener('click', toggleVoiceRecognition);

// Initialize the chat
initializeChat();