import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
const db = getFirestore(app);

const OPENROUTER_API_KEY = "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"; 

// --- ЭЛЕМЕНТЫ СТРАНИЦЫ ---
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const userEmailSpan = document.getElementById('user-email');
const authMessage = document.getElementById('auth-message');

// Элементы медкарты
const bloodTypeInput = document.getElementById('blood-type');
const allergiesInput = document.getElementById('allergies');
const diseasesInput = document.getElementById('diseases');
const saveMedBtn = document.getElementById('save-med-btn');
const saveStatus = document.getElementById('save-status');

// --- АВТОРИЗАЦИЯ ---
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        userEmailSpan.textContent = user.email;
        emailInput.value = ""; passwordInput.value = "";
        
        // Загружаем историю чата
        loadChatHistory(user.uid);
        // Загружаем медицинскую карту
        loadMedicalData(user.uid);
    } else {
        authSection.style.display = 'block';
        appSection.style.display = 'none';
        chatMessages.innerHTML = '<div class="message bot-message">Здравствуйте! Я ваш медицинский ассистент. Чем я могу помочь? Помните, что я не заменяю врача.</div>';
        bloodTypeInput.value = ''; allergiesInput.value = ''; diseasesInput.value = '';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- МЕДИЦИНСКАЯ КАРТА ---
async function loadMedicalData(userId) {
    try {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists() && docSnap.data().medicalData) {
            const data = docSnap.data().medicalData;
            bloodTypeInput.value = data.bloodType || '';
            allergiesInput.value = data.allergies || '';
            diseasesInput.value = data.diseases || '';
        }
    } catch (error) {
        console.error("Ошибка загрузки медкарты:", error);
    }
}

saveMedBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    saveStatus.textContent = "Сохранение...";
    saveStatus.style.color = "gray";

    try {
        await setDoc(doc(db, "users", user.uid), {
            medicalData: {
                bloodType: bloodTypeInput.value,
                allergies: allergiesInput.value,
                diseases: diseasesInput.value
            }
        }, { merge: true });
        
        saveStatus.textContent = "Данные успешно сохранены!";
        saveStatus.style.color = "green";
        setTimeout(() => { saveStatus.textContent = ""; }, 3000); // Скрываем через 3 сек
    } catch (error) {
        console.error("Ошибка сохранения:", error);
        saveStatus.textContent = "Ошибка сохранения. Проверьте права доступа.";
        saveStatus.style.color = "red";
    }
});

// --- ЧАТ-АССИСТЕНТ ---
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');
const chatMessages = document.getElementById('chat-messages');

chatToggleBtn.addEventListener('click', () => chatWindow.classList.remove('hidden'));
closeChatBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));

function addMessageDOM(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function saveMessageToDB(userId, text, sender) {
    try {
        await setDoc(doc(db, "users", userId), {
            chatHistory: arrayUnion({ text: text, sender: sender, timestamp: new Date().toISOString() })
        }, { merge: true });
    } catch (error) { console.error("Ошибка сохранения сообщения:", error); }
}

async function loadChatHistory(userId) {
    try {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists() && docSnap.data().chatHistory) {
            chatMessages.innerHTML = ''; 
            docSnap.data().chatHistory.forEach(msg => addMessageDOM(msg.text, msg.sender));
        }
    } catch (error) { console.error("Ошибка загрузки истории:", error); }
}

sendMsgBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const user = auth.currentUser;
    if (!user) return;

    addMessageDOM(text, 'user');
    saveMessageToDB(user.uid, text, 'user');
    chatInput.value = '';

    // Получаем данные медкарты для контекста ИИ
    let medContext = "У пользователя пока не заполнена медицинская карта.";
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists() && docSnap.data().medicalData) {
            const data = docSnap.data().medicalData;
            if(data.bloodType || data.allergies || data.diseases) {
                medContext = `Медицинские данные пользователя: Группа крови: ${data.bloodType || 'не указана'}, Аллергии: ${data.allergies || 'нет'}, Хронические болезни: ${data.diseases || 'нет'}. Учитывай это при ответе.`;
            }
        }
    } catch (e) { console.error(e); }

    const systemPrompt = `Ты — вежливый виртуальный медицинский ассистент. Обязательно напоминай, что твои советы не заменяют консультацию реального врача. ${medContext}`;

    const freeModels = [
        "google/gemma-2-9b-it:free",
        "meta-llama/llama-3-8b-instruct:free",
        "mistralai/mistral-7b-instruct:free",
        "openrouter/free"
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
                        { role: "system", content: systemPrompt },
                        { role: "user", content: text }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    const aiReply = data.choices[0].message.content;
                    addMessageDOM(aiReply, 'bot');
                    saveMessageToDB(user.uid, aiReply, 'bot');
                    success = true;
                    break; 
                }
            } 
            else if (response.status === 429) { continue; }
            else { continue; }
        } catch (error) { continue; }
    }

    if (!success) {
        const errorMsg = "Извините, все бесплатные модели сейчас перегружены. Подождите минуту.";
        addMessageDOM(errorMsg, 'bot');
        saveMessageToDB(user.uid, errorMsg, 'bot');
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsgBtn.click();
});
