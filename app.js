import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

const CLOUDINARY_CLOUD_NAME = "rjdmw1u"; 
const CLOUDINARY_UPLOAD_PRESET = "medical_upload"; 
const CLOUDINARY_API_KEY = "856839289392595";
const OPENROUTER_API_KEY = "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"; 
const FREE_MODELS = ["google/gemma-2-9b-it:free", "meta-llama/llama-3-8b-instruct:free", "openrouter/free"];

// СЕКРЕТНЫЕ КЛЮЧИ ДЛЯ РЕГИСТРАЦИИ
const KEY_DOCTOR = "DOCTOR2026";
const KEY_ADMIN = "ADMIN2026";

let currentPatients = [];
let currentRequests = [];
let currentModalPatientId = null;

// --- УТИЛИТЫ ---
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

async function callAI(messages) {
    for (const model of FREE_MODELS) {
        try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST", headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model, messages })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.choices?.length > 0) return data.choices[0].message.content;
            }
        } catch (e) { continue; }
    }
    throw new Error("VPN не включен или все модели перегружены.");
}

// --- АВТОРИЗАЦИЯ ---
document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const key = document.getElementById('reg-key').value.trim();
    const msg = document.getElementById('auth-message');

    let role = 'patient';
    if (key === KEY_DOCTOR) role = 'doctor';
    if (key === KEY_ADMIN) role = 'admin';

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        // Сохраняем роль в БД
        await setDoc(doc(db, "users", userCred.user.uid), {
            email: email,
            role: role,
            registrationDate: new Date().toLocaleDateString('ru-RU')
        });
        msg.textContent = "Регистрация успешна!";
        msg.style.color = "green";
    } catch (e) {
        msg.textContent = "Ошибка: " + e.message;
        msg.style.color = "red";
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .catch(e => document.getElementById('auth-message').textContent = "Ошибка: " + e.message);
});

// --- МАРШРУТИЗАЦИЯ ПО РОЛЯМ ---
onAuthStateChanged(auth, async (user) => {
    const authSec = document.getElementById('auth-section');
    const patSec = document.getElementById('patient-section');
    const docSec = document.getElementById('doctor-section');
    const admSec = document.getElementById('admin-section');

    if (user) {
        authSec.style.display = 'none';
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role === 'patient') {
                patSec.style.display = 'block';
                loadPatientChat(user.uid);
            } else if (role === 'doctor') {
                docSec.style.display = 'flex';
                loadDoctorData(user.uid);
            } else if (role === 'admin') {
                admSec.style.display = 'flex';
                loadAdminData();
            }
        } else {
            // Если пользователь есть в Auth, но нет в базе ролей (старый аккаунт)
            // Принудительно выходим, чтобы он зарегистрировался заново с ролью
            await signOut(auth);
            alert("Ваш аккаунт устарел. Пожалуйста, зарегистрируйтесь заново, чтобы получить новую роль.");
        }
    } else {
        authSec.style.display = 'flex';
        patSec.style.display = 'none';
        docSec.style.display = 'none';
        admSec.style.display = 'none';
    }
});

// --- ЛОГИКА ПАЦИЕНТА ---
document.getElementById('submit-request-btn').addEventListener('click', async () => {
    const user = auth.currentUser;
    if(!user) return;

    const req = {
        patientId: user.uid,
        fullName: document.getElementById('p-fullname').value,
        dob: document.getElementById('p-dob').value,
        snils: document.getElementById('p-snils').value,
        policy: document.getElementById('p-policy').value,
        city: document.getElementById('p-city').value,
        reason: document.getElementById('p-reason').value,
        status: 'pending',
        doctorId: null
    };

    if (!req.fullName || !req.reason) return showToast("Заполните ФИО и причину", "error");

    await addDoc(collection(db, "requests"), req);
    showToast("Заявка отправлена врачу!");
    document.getElementById('p-reason').value = '';
});

document.getElementById('patient-logout-btn').addEventListener('click', () => signOut(auth));

// --- ЛОГИКА ВРАЧА ---
function loadDoctorData(uid) {
    loadProfile(uid);
    loadPatients(uid);
    loadSchedule(uid);
    loadRequests();
}

// Вкладки
document.querySelectorAll('#doctor-section .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#doctor-section .nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#doctor-section .view-section').forEach(v => v.classList.remove('active-view'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active-view');
    });
});

async function loadProfile(uid) {
    const docSnap = await getDoc(doc(db, "doctors", uid));
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
        await setDoc(doc(db, "doctors", uid), { registrationDate: today });
    }
}

document.getElementById('save-profile-btn').addEventListener('click', async () => {
    await setDoc(doc(db, "doctors", auth.currentUser.uid), {
        fullName: document.getElementById('d-fullname').value,
        phone: document.getElementById('d-phone').value,
        experience: document.getElementById('d-experience').value
    }, { merge: true });
    showToast("Профиль обновлен");
});

document.getElementById('avatar-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file); formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); formData.append('api_key', CLOUDINARY_API_KEY);
    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
            await setDoc(doc(db, "doctors", auth.currentUser.uid), { photoURL: data.secure_url }, { merge: true });
            document.getElementById('profile-avatar-img').src = data.secure_url;
            showToast("Фото загружено");
        }
    } catch (e) { showToast("Ошибка фото", "error"); }
});

async function loadRequests() {
    const tbody = document.getElementById('requests-list');
    tbody.innerHTML = '';
    const snap = await getDocs(query(collection(db, "requests"), where("status", "==", "pending")));
    
    snap.forEach(d => {
        const r = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.fullName}</td><td>${r.dob}</td><td>${r.snils}</td><td>${r.city}</td><td>${r.reason}</td>
            <td><button class="btn btn-primary" onclick="acceptRequest('${d.id}', '${r.fullName}', '${r.reason}')">Принять</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.acceptRequest = async (id, name, reason) => {
    // Добавляем в базу пациентов врача
    await addDoc(collection(db, "doctors", auth.currentUser.uid, "patients"), { name, symptoms: reason });
    // Обновляем статус заявки
    await updateDoc(doc(db, "requests", id), { status: 'accepted', doctorId: auth.currentUser.uid });
    showToast("Пациент добавлен в базу");
    loadRequests(); loadPatients(auth.currentUser.uid);
};

// Остальные функции врача (Пациенты, Расписание) остаются прежними...
async function loadPatients(doctorId) {
    currentPatients = [];
    const snap = await getDocs(collection(db, "doctors", doctorId, "patients"));
    snap.forEach(d => currentPatients.push({ id: d.id, ...d.data() }));
    
    const tbody = document.getElementById('patients-list');
    tbody.innerHTML = '';
    currentPatients.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.snils || '-'}</td><td>${p.dob || '-'}</td><td>${p.symptoms}</td><td><span class="action-link danger" onclick="deletePatient('${p.id}')">Удалить</span></td></tr>`;
    });
    
    const select = document.getElementById('s-patient');
    select.innerHTML = '<option value="">Выберите пациента</option>';
    currentPatients.forEach(p => { select.innerHTML += `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`; });
}

document.getElementById('add-patient-btn').addEventListener('click', async () => {
    await addDoc(collection(db, "doctors", auth.currentUser.uid, "patients"), {
        name: document.getElementById('d-p-name').value,
        snils: document.getElementById('d-p-snils').value,
        dob: document.getElementById('d-p-dob').value,
        symptoms: document.getElementById('d-p-symptoms').value
    });
    loadPatients(auth.currentUser.uid);
    showToast("Добавлено");
});

window.deletePatient = async (id) => {
    if(confirm("Удалить?")) {
        await deleteDoc(doc(db, "doctors", auth.currentUser.uid, "patients", id));
        loadPatients(auth.currentUser.uid);
    }
};

document.getElementById('add-schedule-btn').addEventListener('click', async () => {
    const sel = document.getElementById('s-patient');
    await addDoc(collection(db, "doctors", auth.currentUser.uid, "schedule"), {
        patientId: sel.value, patientName: sel.options[sel.selectedIndex]?.dataset.name,
        date: document.getElementById('s-date').value, time: document.getElementById('s-time').value,
        reason: document.getElementById('s-reason').value
    });
    loadSchedule(auth.currentUser.uid);
    showToast("Записан");
});

async function loadSchedule(doctorId) {
    const tbody = document.getElementById('schedule-list');
    tbody.innerHTML = '';
    const snap = await getDocs(collection(db, "doctors", doctorId, "schedule"));
    snap.forEach(d => {
        const s = d.data();
        tbody.innerHTML += `<tr><td>${s.date}</td><td>${s.time}</td><td>${s.patientName}</td><td>${s.reason || '-'}</td><td><span class="action-link danger" onclick="deleteSchedule('${d.id}')">Отменить</span></td></tr>`;
    });
}

window.deleteSchedule = async (id) => {
    await deleteDoc(doc(db, "doctors", auth.currentUser.uid, "schedule", id));
    loadSchedule(auth.currentUser.uid);
};

document.getElementById('doctor-logout-btn').addEventListener('click', () => signOut(auth));


// --- ЛОГИКА АДМИНА ---
async function loadAdminData() {
    loadAdminUsers();
    loadAdminRequests();
}

document.querySelectorAll('#admin-section .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#admin-section .nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#admin-section .view-section').forEach(v => v.classList.remove('active-view'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active-view');
    });
});

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-users-list');
    tbody.innerHTML = '';
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
        const u = d.data();
        tbody.innerHTML += `<tr><td>${u.email}</td><td>${u.role}</td><td>${u.role === 'doctor' ? 'Врач' : 'Пациент'}</td><td><span class="action-link danger" onclick="adminDeleteUser('${d.id}')">Удалить</span></td></tr>`;
    });
}

async function loadAdminRequests() {
    const tbody = document.getElementById('admin-requests-list');
    tbody.innerHTML = '';
    const snap = await getDocs(collection(db, "requests"));
    snap.forEach(d => {
        const r = d.data();
        tbody.innerHTML += `<tr><td>${r.fullName}</td><td>${r.reason}</td><td>${r.status}</td></tr>`;
    });
}

window.adminDeleteUser = async (id) => {
    if(confirm("Удалить пользователя навсегда?")) {
        await deleteDoc(doc(db, "users", id));
        loadAdminUsers();
    }
};

document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));


// --- ЧАТЫ ДЛЯ ПАЦИЕНТА И ВРАЧА ---
// Пациент
document.getElementById('chat-toggle-btn').onclick = () => document.getElementById('chat-window').classList.remove('hidden');
document.getElementById('close-chat-btn').onclick = () => document.getElementById('chat-window').classList.add('hidden');

document.getElementById('send-msg-btn').onclick = async () => {
    const input = document.getElementById('chat-input');
    const msgs = document.getElementById('chat-messages');
    if(!input.value) return;
    
    msgs.innerHTML += `<div class="message user-message">${input.value}</div>`;
    const text = input.value; input.value = '';
    msgs.innerHTML += `<div class="message bot-message">Анализирую...</div>`;
    
    try {
        const reply = await callAI([{ role: "system", content: "Ты вежливый медицинский ассистент. Подскажи, к какому врачу обратиться." }, { role: "user", content: text }]);
        msgs.lastChild.remove();
        msgs.innerHTML += `<div class="message bot-message">${reply}</div>`;
    } catch(e) {
        msgs.lastChild.remove();
        msgs.innerHTML += `<div class="message bot-message">Включите VPN для работы ИИ.</div>`;
    }
};

// Врач
document.getElementById('chat-toggle-btn-doc').onclick = () => document.getElementById('chat-window-doc').classList.remove('hidden');
document.getElementById('close-chat-btn-doc').onclick = () => document.getElementById('chat-window-doc').classList.add('hidden');

document.getElementById('send-msg-btn-doc').onclick = async () => {
    const input = document.getElementById('chat-input-doc');
    const msgs = document.getElementById('chat-messages-doc');
    if(!input.value) return;

    msgs.innerHTML += `<div class="message user-message">${input.value}</div>`;
    const text = input.value; input.value = '';
    msgs.innerHTML += `<div class="message bot-message">Думаю...</div>`;

    let context = "Пациенты:\n";
    currentPatients.forEach(p => context += `- ${p.name} (${p.symptoms})\n`);

    try {
        const reply = await callAI([{ role: "system", content: `Ты ассистент врача. Данные: ${context}` }, { role: "user", content: text }]);
        msgs.lastChild.remove();
        msgs.innerHTML += `<div class="message bot-message">${reply}</div>`;
    } catch(e) {
        msgs.lastChild.remove();
        msgs.innerHTML += `<div class="message bot-message">Включите VPN для работы ИИ.</div>`;
    }
};

function loadPatientChat(uid) {
    // Логика истории чата (можно добавить по аналогии с врачом, если нужно)
}
