import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
// Импортируем функции для работы с коллекциями (таблицами) в Firestore
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

// Элементы таблицы
const patientsList = document.getElementById('patients-list');
const pNameInput = document.getElementById('p-name');
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
        // Загружаем список пациентов для этого врача
        loadPatients(user.uid);
    } else {
        authSection.style.display = 'block';
        appSection.style.display = 'none';
        patientsList.innerHTML = ''; // Очищаем таблицу при выходе
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- РАБОТА С ПАЦИЕНТАМИ (База данных) ---

// 1. Загрузка пациентов
async function loadPatients(doctorId) {
    patientsList.innerHTML = '';
    // Каждый врач имеет свою папку с пациентами: doctors -> {id} -> patients
    const patientsRef = collection(db, "doctors", doctorId, "patients");
    const querySnapshot = await getDocs(patientsRef);
    
    querySnapshot.forEach((docSnap) => {
        const patient = docSnap.data();
        addPatientToTable(docSnap.id, patient.name, patient.symptoms);
    });
}

// 2. Отрисовка строки в таблице
function addPatientToTable(id, name, symptoms) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${name}</td>
        <td>${symptoms}</td>
        <td><button class="delete-btn" data-id="${id}">Удалить</button></td>
    `;
    patientsList.appendChild(tr);

    // Добавляем обработчик на кнопку удаления
    tr.querySelector('.delete-btn').addEventListener('click', async (e) => {
        const patientId = e.target.getAttribute('data-id');
        await deletePatient(id, patientId);
    });
}

// 3. Добавление пациента
addPatientBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    const name = pNameInput.value.trim();
    const symptoms = pSymptomsInput.value.trim();

    if (!name || !symptoms) {
        alert("Заполните ФИО и жалобы пациента!");
        return;
    }

    try {
        const patientsRef = collection(db, "doctors", user.uid, "patients");
        await addDoc(patientsRef, { name: name, symptoms: symptoms });
        
        // Очищаем поля и обновляем таблицу
        pNameInput.value = '';
        pSymptomsInput.value = '';
        loadPatients(user.uid);
    } catch (error) {
        console.error("Ошибка добавления:", error);
        alert("Не удалось добавить пациента.");
    }
});

// 4. Удаление пациента
async function deletePatient(doctorId, patientId) {
    if(!confirm("Вы уверены, что хотите удалить запись пациента?")) return;
    
    try {
        await deleteDoc(doc(db, "doctors", doctorId, "patients", patientId));
        loadPatients(doctorId); // Обновляем таблицу
    } catch (error) {
        console.error("Ошибка удаления:", error);
    }
}


// --- ЛОГИКА ИИ ЧАТА (Остается без изменений) ---
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

sendMsgBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    addMessageDOM(text, 'user');
    chatInput.value = '';

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
                        { role: "system", content: "Ты — умный ассистент для врача. Ты помогаешь врачу анализировать симптомы пациентов, предлагаешь возможные предварительные диагнозы и рекомендуешь, какие анализы сдать. Ты общаешься с профессионалом, поэтому можешь использовать медицинские термины." },
                        { role: "user", content: text }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    addMessageDOM(data.choices[0].message.content, 'bot');
                    success = true;
                    break; 
                }
            } else if (response.status === 429) { continue; } else { continue; }
        } catch (error) { continue; }
    }

    if (!success) {
        addMessageDOM("Все бесплатные модели сейчас перегружены. Подождите минуту.", 'bot');
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsgBtn.click();
});
