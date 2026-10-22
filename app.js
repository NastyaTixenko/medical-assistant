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

// --- Firebase Auth Логика ---
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

// --- Логика ИИ Чата ---
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');
const chatMessages = document.getElementById('chat-messages');

// Открытие/закрытие чата
chatToggleBtn.addEventListener('click', () => chatWindow.classList.remove('hidden'));
closeChatBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));

// Функция добавления сообщения на экран
function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Скролл вниз
}

// Отправка сообщения в ИИ
sendMsgBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    chatInput.value = '';

    try {
        // Отправляем запрос в OpenRouter (используем бесплатную модель Llama 3)
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.1-8b-instruct:free", // Бесплатная модель
                messages: [
                    { role: "system", content: "Ты — вежливый виртуальный медицинский ассистент. Ты помогаешь пользователям разобраться в симптомах и подсказываешь, к какому врачу обратиться. Обязательно напоминай, что твои советы не заменяют консультацию реального врача." },
                    { role: "user", content: text }
                ]
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            const aiReply = data.choices[0].message.content;
            addMessage(aiReply, 'bot');
        } else {
            addMessage("Извините, произошла ошибка при получении ответа. Попробуйте позже.", 'bot');
        }
    } catch (error) {
        console.error(error);
        addMessage("Ошибка сети. Проверьте подключение к интернету.", 'bot');
    }
});

// Отправка по нажатию Enter
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsgBtn.click();
});
