import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
// Импорт для работы с фото
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

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
const storage = getStorage(app);
const OPENROUTER_API_KEY = "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"; 

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentPatients = [];
let patientToDeleteId = null;

// --- УТИЛИТЫ (Уведомления и Модалки) ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function showConfirm(text, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-text').textContent = text;
    modal.classList.add('active');
    
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    
    const close = () => modal.classList.remove('active');
    
    yesBtn.onclick = () => { onConfirm(); close(); };
    noBtn.onclick = close;
}

// --- АВТОРИЗАЦИЯ ---
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');

document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .catch(e => document.getElementById('auth-message').textContent = "Ошибка: " + e.message);
});

document.getElementById('signup-btn').addEventListener('click', () => {
    createUserWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .catch(e => document.getElementById('auth-message').textContent = "Ошибка: " + e.message);
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = 'none';
        appSection.style.display = 'flex';
        loadProfile(user.uid);
        loadPatients(user.uid);
        loadSchedule(user.uid);
    } else {
        authSection.style.display = 'flex';
        appSection.style.display = 'none';
    }
});

// --- НАВИГАЦИЯ (Вкладки) ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active-view');
    });
});

// --- ПРОФИЛЬ ---
async function loadProfile(userId) {
    const docSnap = await getDoc(doc(db, "doctors", userId));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('d-fullname').value = d.fullName || "";
        document.getElementById('d-phone').value = d.phone || "";
        document.getElementById('d-experience').value = d.experience || "";
        document.getElementById('reg-date').textContent = d.registrationDate || "Неизвестно";
        if (d.photoURL) document.getElementById('profile-avatar-img').src = d.photoURL;
    } else {
        const today = new Date().toLocaleDateString('ru-RU');
        document.getElementById('reg-date').textContent = today;
        await setDoc(doc(db, "doctors", userId), { registrationDate: today, fullName: "", phone: "", experience: "" });
    }
}

document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const user = auth.currentUser;
    await setDoc(doc(db, "doctors", user.uid), {
        fullName: document.getElementById('d-fullname').value,
        phone: document.getElementById('d-phone').value,
        experience: document.getElementById('d-experience').value
    }, { merge: true });
    showToast("Профиль успешно обновлен");
});

// Загрузка фото
document.getElementById('avatar-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const user = auth.currentUser;
    
    const storageRef = ref(storage, `avatars/${user.uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    
    await setDoc(doc(db, "doctors", user.uid), { photoURL: url }, { merge: true });
    document.getElementById('profile-avatar-img').src = url;
    showToast("Фото загружено");
});

// --- ПАЦИЕНТЫ ---
async function loadPatients(doctorId) {
    currentPatients = [];
    const snap = await getDocs(collection(db, "doctors", doctorId, "patients"));
    snap.forEach(d => currentPatients.push({ id: d.id, ...d.data() }));
    renderPatientsTable();
    updatePatientSelect();
}

function renderPatientsTable(filterText = '') {
    const tbody = document.getElementById('patients-list');
    tbody.innerHTML = '';
    
    const filtered = currentPatients.filter(p => 
        p.name.toLowerCase().includes(filterText.toLowerCase()) || 
        (p.snils && p.snils.includes(filterText))
    );

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.name}</td>
            <td>${p.snils || '-'}</td>
            <td>${p.dob || '-'}</td>
            <td>${p.symptoms}</td>
            <td>
                <span class="action-link" onclick="openPatientModal('${p.id}')">Карта</span>
                <span class="action-link danger" onclick="promptDeletePatient('${p.id}')">Удалить</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Поиск
document.getElementById('search-patient').addEventListener('input', (e) => {
    renderPatientsTable(e.target.value);
});

document.getElementById('add-patient-btn').addEventListener('click', async () => {
    const user = auth.currentUser;
    const name = document.getElementById('p-name').value;
    const snils = document.getElementById('p-snils').value;
    const dob = document.getElementById('p-dob').value;
    const symptoms = document.getElementById('p-symptoms').value;

    if (!name || !symptoms) return showToast("Заполните ФИО и жалобы", "error");

    await addDoc(collection(db, "doctors", user.uid, "patients"), { name, snils, dob, symptoms });
    document.getElementById('p-name').value = ''; document.getElementById('p-snils').value = ''; document.getElementById('p-symptoms').value = '';
    loadPatients(user.uid);
    showToast("Пациент добавлен");
});

// Экспорт в CSV
document.getElementById('export-csv-btn').addEventListener('click', () => {
    if (currentPatients.length === 0) return showToast("Нет данных для экспорта", "error");
    
    let csv = "ФИО;СНИЛС;Дата рождения;Жалобы\n";
    currentPatients.forEach(p => {
        csv += `"${p.name}";"${p.snils || ''}";"${p.dob || ''}";"${p.symptoms}"\n`;
    });
    
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "patients_export.csv";
    link.click();
});

// Удаление
window.promptDeletePatient = (id) => {
    showConfirm("Вы действительно хотите удалить пациента из базы?", async () => {
        await deleteDoc(doc(db, "doctors", auth.currentUser.uid, "patients", id));
        loadPatients(auth.currentUser.uid);
        showToast("Пациент удален");
    });
};

// --- РАСПИСАНИЕ ---
function updatePatientSelect() {
    const select = document.getElementById('s-patient');
    select.innerHTML = '<option value="">Выберите пациента</option>';
    currentPatients.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`;
    });
}

document.getElementById('add-schedule-btn').addEventListener('click', async () => {
    const user = auth.currentUser;
    const select = document.getElementById('s-patient');
    const patientId = select.value;
    const patientName = select.options[select.selectedIndex]?.dataset.name;
    const date = document.getElementById('s-date').value;
    const time = document.getElementById('s-time').value;
    const reason = document.getElementById('s-reason').value;

    if (!patientId || !date || !time) return showToast("Заполните все поля", "error");

    await addDoc(collection(db, "doctors", user.uid, "schedule"), { patientId, patientName, date, time, reason });
    document.getElementById('s-reason').value = '';
    loadSchedule(user.uid);
    showToast("Прием назначен");
});

async function loadSchedule(doctorId) {
    const tbody = document.getElementById('schedule-list');
    tbody.innerHTML = '';
    const snap = await getDocs(collection(db, "doctors", doctorId, "schedule"));
    
    // Сортировка по дате и времени
    let schedule = [];
    snap.forEach(d => schedule.push({ id: d.id, ...d.data() }));
    schedule.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    schedule.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.date}</td>
            <td>${s.time}</td>
            <td>${s.patientName}</td>
            <td>${s.reason || '-'}</td>
            <td><span class="action-link danger" onclick="deleteSchedule('${s.id}')">Отменить</span></td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteSchedule = (id) => {
    showConfirm("Отменить этот прием?", async () => {
        await deleteDoc(doc(db, "doctors", auth.currentUser.uid, "schedule", id));
        loadSchedule(auth.currentUser.uid);
        showToast("Прием отменен");
    });
};

// --- МОДАЛКА ПАЦИЕНТА И ИИ ---
let currentModalPatientId = null;

window.openPatientModal = (id) => {
    const p = currentPatients.find(x => x.id === id);
    if (!p) return;
    
    currentModalPatientId = id;
    document.getElementById('modal-patient-name').textContent = p.name;
    document.getElementById('modal-patient-snils').textContent = p.snils || '-';
    document.getElementById('modal-patient-dob').textContent = p.dob || '-';
    document.getElementById('modal-patient-symptoms').textContent = p.symptoms;
    document.getElementById('ai-prescription-text').value = p.prescription || '';
    
    document.getElementById('patient-modal').classList.add('active');
};

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.onclick = () => document.getElementById('patient-modal').classList.remove('active');
});

document.getElementById('generate-prescription-btn').addEventListener('click', async () => {
    const p = currentPatients.find(x => x.id === currentModalPatientId);
    const btn = document.getElementById('generate-prescription-btn');
    btn.textContent = "Генерация...";
    
    const prompt = `Ты врач. Пациент: ${p.name}, жалобы: ${p.symptoms}. Напиши краткий план лечения и рекомендации.`;
    
    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemma-2-9b-it:free", messages: [{ role: "user", content: prompt }] })
        });
        const data = await res.json();
        document.getElementById('ai-prescription-text').value = data.choices[0].message.content;
    } catch (e) {
        showToast("Ошибка генерации ИИ", "error");
    }
    btn.textContent = "Сгенерировать через ИИ";
});

document.getElementById('save-prescription-btn').addEventListener('click', async () => {
    const text = document.getElementById('ai-prescription-text').value;
    await updateDoc(doc(db, "doctors", auth.currentUser.uid, "patients", currentModalPatientId), {
        prescription: text
    });
    showToast("Назначение сохранено в карту");
    document.getElementById('patient-modal').classList.remove('active');
    loadPatients(auth.currentUser.uid);
});

// --- ЧАТ-АССИСТЕНТ ---
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');
const chatMessages = document.getElementById('chat-messages');

chatToggleBtn.onclick = () => chatWindow.classList.remove('hidden');
closeChatBtn.onclick = () => chatWindow.classList.add('hidden');

function addChatMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendMsgBtn.onclick = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    addChatMessage(text, 'user');
    chatInput.value = '';
    addChatMessage("Думаю...", 'bot');

    // Собираем контекст: Пациенты + Расписание
    let context = "Пациенты:\n";
    currentPatients.forEach(p => context += `- ${p.name}, жалобы: ${p.symptoms}\n`);
    
    const scheduleSnap = await getDocs(collection(db, "doctors", auth.currentUser.uid, "schedule"));
    context += "\nРасписание:\n";
    scheduleSnap.forEach(s => context += `- ${s.data().date} в ${s.data().time}: ${s.data().patientName}\n`);

    const sysPrompt = `Ты ассистент врача. Отвечай на вопросы, используя эти данные:\n${context}`;

    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "meta-llama/llama-3-8b-instruct:free", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: text }] })
        });
        const data = await res.json();
        chatMessages.removeChild(chatMessages.lastChild);
        addChatMessage(data.choices[0].message.content, 'bot');
    } catch (e) {
        chatMessages.removeChild(chatMessages.lastChild);
        addChatMessage("Ошибка соединения.", 'bot');
    }
};

chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMsgBtn.click(); });
