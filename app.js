import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

// --- ЭЛЕМЕНТЫ ---
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const userEmailSpan = document.getElementById('user-email');
const authMessage = document.getElementById('auth-message');

const patientsList = document.getElementById('patients-list');
const pNameInput = document.getElementById('p-name');
const pSnilsInput = document.getElementById('p-snils');
const pDobInput = document.getElementById('p-dob');
const pSymptomsInput = document.getElementById('p-symptoms');
const addPatientBtn = document.getElementById('add-patient-btn');

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

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        userEmailSpan.textContent = user.email;
        emailInput.value = ""; passwordInput.value = "";
        loadPatients(user.uid);
    } else {
        authSection.style.display = 'block';
        appSection.style.display = 'none';
        patientsList.innerHTML = ''; 
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- РАБОТА С ПАЦИЕНТАМИ ---
async function loadPatients(doctorId) {
    patientsList.innerHTML = '';
    const patientsRef = collection(db, "doctors", doctorId, "patients");
    const querySnapshot = await getDocs(patientsRef);
    
    querySnapshot.forEach((docSnap) => {
        const patient = docSnap.data();
        addPatientToTable(docSnap.id, patient.name, patient.snils, patient.dob, patient.symptoms);
    });
}

function addPatientToTable(id, name, snils, dob, symptoms) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${name}</td>
        <td>${snils || '-'}</td>
        <td>${dob || '-'}</td>
        <td>${symptoms}</td>
        <td><button class="delete-btn" data-id="${id}">Удалить</button></td>
    `;
    patientsList.appendChild(tr);

    tr.querySelector('.delete-btn').addEventListener('click', async (e) => {
        const patientId = e.target.getAttribute('data-id');
        await deletePatient(id, patientId);
    });
}

addPatientBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    const name = pNameInput.value.trim();
    const snils = pSnilsInput.value.trim();
    const dob = pDobInput.value;
    const symptoms = pSymptomsInput.value.trim();

    if (!name || !symptoms) {
        alert("Заполните хотя бы ФИО и жалобы пациента!");
        return;
    }

    try {
        const patientsRef = collection(db, "doctors", user.uid, "patients");
        await addDoc(patientsRef, { name: name, snils: snils, dob: dob, symptoms: symptoms });
        
        pNameInput.value = ''; pSnilsInput.value = ''; pDobInput.value = ''; pSymptomsInput.value = '';
        loadPatients(user.uid);
    } catch (error) { console.error(error); }
});

async function deletePatient(doctorId, patientId) {
    if(!confirm("Удалить запись пациента?")) return;
    try {
        await deleteDoc(doc(db, "doctors", doctorId, "patients", patientId));
        loadPatients(doctorId); 
    } catch (error) { console.error(error); }
}


// --- ЛОГИКА ИИ ЧАТА С КОНТЕКСТОМ БАЗЫ ДАННЫХ ---
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

// Функция, которая выгружает базу пациентов в текст для ИИ
async function getPatientsContext(doctorId) {
    const patientsRef = collection(db, "doctors", doctorId, "patients");
    const querySnapshot = await getDocs(patientsRef);
    
    if (querySnapshot.empty) return "База пациентов пуста.";

    let context = "Список пациентов в базе врача:\n";
    querySnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        context += `- ФИО: ${p.name}, СНИЛС: ${p.snils || 'нет'}, Дата рождения: ${p.dob || 'нет'}, Жалобы: ${p.symptoms}\n`;
    });
    return context;
}

sendMsgBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const user = auth.currentUser;
    if (!user) return;

    addMessageDOM(text, 'user');
    chatInput.value = '';

    // Показываем индикатор загрузки, пока ИИ думает
    addMessageDOM("Анализирую базу данных...", 'bot');

    // 1. Получаем данные всех пациентов из Firebase
    const patientsInfo = await getPatientsContext(user.uid);

    // 2. Формируем системный промпт (управление для ИИ)
    const systemPrompt = `Ты — умный ассистент для врача. Ты помогаешь врачу анализировать симптомы пациентов. 
Вот текущая база пациентов этого врача:
${patientsInfo}

Если врач спрашивает про конкретного пациента, найди его в списке выше и используй его жалобы для анализа. Общайся профессионально.`;

    const freeModels = [
        "google/gemma-2-9b-it:free",
        "meta-llama/llama-3-8b-instruct:free",
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
                    // Удаляем сообщение "Анализирую..."
                    chatMessages.removeChild(chatMessages.lastChild);
                    // Добавляем реальный ответ
                    addMessageDOM(data.choices[0].message.content, 'bot');
                    success = true;
                    break; 
                }
            } else if (response.status === 429) { continue; } else { continue; }
        } catch (error) { continue; }
    }

    if (!success) {
        chatMessages.removeChild(chatMessages.lastChild);
        addMessageDOM("Все бесплатные модели сейчас перегружены. Подождите минуту.", 'bot');
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsgBtn.click();
});
