import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
// Добавили setDoc и getDoc для работы с профилем
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authMessage = document.getElementById('auth-message');

// Элементы профиля
const dFullname = document.getElementById('d-fullname');
const dPhone = document.getElementById('d-phone');
const dExperience = document.getElementById('d-experience');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileStatus = document.getElementById('profile-status');
const profileNameDisplay = document.getElementById('profile-name-display');
const regDateSpan = document.getElementById('reg-date');

// Элементы пациентов
const patientsList = document.getElementById('patients-list');
const pNameInput = document.getElementById('p-name');
const pSnilsInput = document.getElementById('p-snils');
const pDobInput = document.getElementById('p-dob');
const pSymptomsInput = document.getElementById('p-symptoms');
const addPatientBtn = document.getElementById('add-patient-btn');

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Убираем активный класс у всех кнопок и вкладок
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-content'));
        
        // Добавляем активный класс нажаттой кнопке и нужной вкладке
        btn.classList.add('active');
        const targetTab = document.getElementById(btn.getAttribute('data-target'));
        targetTab.classList.add('active-content');
    });
});

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
        emailInput.value = ""; passwordInput.value = "";
        
        loadPatients(user.uid);
        loadDoctorProfile(user.uid);
    } else {
        authSection.style.display = 'block';
        appSection.style.display = 'none';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- ЛОГИКА ПРОФИЛЯ ---
async function loadDoctorProfile(userId) {
    const docRef = doc(db, "doctors", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        dFullname.value = data.fullName || "";
        dPhone.value = data.phone || "";
        dExperience.value = data.experience || "";
        regDateSpan.textContent = data.registrationDate || "Неизвестно";
        
        // Отображаем ФИО в заголовке профиля
        profileNameDisplay.textContent = data.fullName || "Врач (ФИО не указано)";
    } else {
        // Если профиль создается впервые
        const today = new Date().toLocaleDateString('ru-RU');
        regDateSpan.textContent = today;
        profileNameDisplay.textContent = "Врач (ФИО не указано)";
        
        // Создаем пустую запись в базе, чтобы сохранить дату регистрации
        await setDoc(docRef, {
            registrationDate: today,
            fullName: "",
            phone: "",
            experience: ""
        });
    }
}

saveProfileBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    saveProfileBtn.textContent = "Сохранение...";
    saveProfileBtn.disabled = true;

    try {
        // setDoc с merge: true обновляет только переданные поля, не стирая остальные
        await setDoc(doc(db, "doctors", user.uid), {
            fullName: dFullname.value,
            phone: dPhone.value,
            experience: dExperience.value
        }, { merge: true });

        profileNameDisplay.textContent = dFullname.value || "Врач (ФИО не указано)";
        
        profileStatus.textContent = "✅ Данные успешно сохранены!";
        setTimeout(() => { profileStatus.textContent = ""; }, 3000);
    } catch (error) {
        console.error(error);
        profileStatus.textContent = "❌ Ошибка сохранения";
        profileStatus.style.color = "red";
    } finally {
        saveProfileBtn.textContent = "💾 Сохранить изменения";
        saveProfileBtn.disabled = false;
    }
});


// --- РАБОТА С ПАЦИЕНТАМИ ---
async function loadPatients(doctorId) {
    patientsList.innerHTML = '';
    const patientsRef = collection(db, "doctors", doctorId, "patients");
    const querySnapshot = await getDocs(patientsRef);
    
    querySnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        addPatientToTable(docSnap.id, p.name, p.snils, p.dob, p.symptoms);
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
        alert("Заполните хотя бы ФИО и жалобы!"); return;
    }

    try {
        const patientsRef = collection(db, "doctors", user.uid, "patients");
        await addDoc(patientsRef, { name, snils, dob, symptoms });
        pNameInput.value = ''; pSnilsInput.value = ''; pDobInput.value = ''; pSymptomsInput.value = '';
        loadPatients(user.uid);
    } catch (error) { console.error(error); }
});

async function deletePatient(doctorId, patientId) {
    if(!confirm("Удалить пациента из базы?")) return;
    try {
        await deleteDoc(doc(db, "doctors", doctorId, "patients", patientId));
        loadPatients(doctorId); 
    } catch (error) { console.error(error); }
}

// --- ИИ ЧАТ (Код остается прежним) ---
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

async function getPatientsContext(doctorId) {
    const patientsRef = collection(db, "doctors", doctorId, "patients");
    const querySnapshot = await getDocs(patientsRef);
    if (querySnapshot.empty) return "База пациентов пуста.";
    let context = "Список пациентов:\n";
    querySnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        context += `- ${p.name} (СНИЛС: ${p.snils || 'нет'}), Жалобы: ${p.symptoms}\n`;
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
    
    // Получаем ФИО врача для контекста
    const doctorName = dFullname.value || "Доктор";
    addMessageDOM("Анализирую...", 'bot');

    const patientsInfo = await getPatientsContext(user.uid);
    const systemPrompt = `Ты — ассистент врача по имени ${doctorName}. Ты помогаешь анализировать симптомы. База пациентов: ${patientsInfo}`;

    const freeModels = ["google/gemma-2-9b-it:free", "meta-llama/llama-3-8b-instruct:free", "openrouter/free"];
    let success = false;

    for (const model of freeModels) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: model,
                    messages: [ { role: "system", content: systemPrompt }, { role: "user", content: text } ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    chatMessages.removeChild(chatMessages.lastChild); // убираем "Анализирую"
                    addMessageDOM(data.choices[0].message.content, 'bot');
                    success = true;
                    break; 
                }
            } else if (response.status === 429) { continue; } else { continue; }
        } catch (error) { continue; }
    }

    if (!success) {
        chatMessages.removeChild(chatMessages.lastChild);
        addMessageDOM("Все модели перегружены. Подождите.", 'bot');
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsgBtn.click();
});
