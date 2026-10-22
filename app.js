import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// ТВОЙ FIREBASE КОНФИГ
const firebaseConfig = {
  apiKey: "AIzaSyBp8WY8Q63pXT4tpb5_gUJCK54wbU4SnbQ",
  authDomain: "medpomoshnick.firebaseapp.com",
  projectId: "medpomoshnick",
  storageBucket: "medpomoshnick.firebasestorage.app",
  messagingSenderId: "606497722603",
  appId: "1:606497722603:web:8d3194cc687129be92aeae",
  measurementId: "G-9QS66EZR4C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ТВОЙ КЛЮЧ ОТ OPENROUTER
const OPENROUTER_API_KEY = "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"; 

// --- ЛОГИКА АВТОРИЗАЦИИ FIREBASE ---
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const userEmailSpan = document.getElementById('user-email');
const authMessage = document.getElementById('auth-message');

signupBtn.addEventListener('click', () => {
    createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
        .then(() => { authMessage.textContent = "Регистрация успешна!"; authMessage.style.color = "green"; })
        .catch((error) => { authMessage.textContent = "Ошибка: " + error.message; authMessage.style.color = "red"; });
});

loginBtn.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
        .then(() => { authMessage.textContent = ""; })
        .catch((error) => { authMessage.textContent = "Ошибка: " + error.message; authMessage.style.color = "red"; });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        userEmailSpan.textContent = user.email;
        emailInput.value = ""; passwordInput.value = "";
    } else {
        authSection.style.display = 'block';
        appSection.style.display = 'none';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- ЛОГИКА ИИ ЧАТА ---
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');
const chatMessages = document.getElementById('chat-messages');

chatToggleBtn.addEventListener('click', () => chatWindow.classList.remove('hidden'));
closeChatBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Отправка сообщения с умным переключением моделей при ошибке 429
sendMsgBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    chatInput.value = '';

    // Список резервных бесплатных моделей
    const freeModels = [
        "google/gemma-2-9b-it:free",
        "meta-llama/llama-3-8b-instruct:free",
        "mistralai/mistral-7b-instruct:free",
        "openrouter/free" // Универсальный роутер
    ];

    let success = false;

    for (const model of freeModels) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "Ты — вежливый виртуальный медицинский ассистент. Ты помогаешь пользователям разобраться в симптомах и подсказываешь, к какому врачу обратиться. Обязательно напоминай, что твои советы не заменяют консультацию реального врача." },
                        { role: "user", content: text }
                    ]
                })
            });

            // Если ответ успешный
            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    const aiReply = data.choices[0].message.content;
                    addMessage(aiReply, 'bot');
                    success = true;
                    break; // Выходим из цикла, так как получили ответ
                }
            } 
            // Если ошибка 429 (лимит) - идем к следующей модели
            else if (response.status === 429) {
                console.warn(`Модель ${model} перегружена (429). Пробуем следующую...`);
                continue; 
            }
            else {
                console.warn(`Ошибка ${response.status} для модели ${model}. Пробуем следующую...`);
                continue;
            }
        } catch (error) {
            console.error(`Ошибка сети для модели ${model}:`, error);
            continue;
        }
    }

    // Если все модели выдали ошибку
    if (!success) {
        addMessage("Извините, все бесплатные модели сейчас перегружены. Пожалуйста, подождите минуту и попробуйте снова.", 'bot');
    }
});

// Отправка по нажатию Enter
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsgBtn.click();
});
