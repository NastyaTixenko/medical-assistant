import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- НАСТРОЙКИ FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBp8WY8Q63pXT4tpb5_gUJCK54wbU4SnbQ",
  authDomain: "medpomoshnick.firebaseapp.com",
  projectId: "medpomoshnick",
  storageBucket: "medpomoshnick.firebasestorage.app",
  messagingSenderId: "606497722603",
  appId: "1:606497722603:web:8d3194cc687129be92aeae"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- НАСТРОЙКИ CLOUDINARY И ИИ ---
const CLOUDINARY_CLOUD_NAME = "rjdmw1u"; 
const CLOUDINARY_UPLOAD_PRESET = "medical_upload"; 
const CLOUDINARY_API_KEY = "856839289392595";
const OPENROUTER_API_KEY = "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"; 
const KEY_DOCTOR = "DOCTOR2026";
const KEY_ADMIN = "ADMIN2026";
const FREE_MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "openrouter/free"];

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentPatients = [];
let currentSchedule = []; 
let currentModalPatientId = null;
let isRegistering = false;
let currentEditContext = null;

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
                method: "POST", 
                headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: model, messages: messages, temperature: 0.5 })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.choices && data.choices.length > 0) return data.choices[0].message.content;
            }
        } catch (e) { continue; }
    }
    throw new Error("Ошибка ИИ. Проверьте VPN.");
}

// --- АВТОРИЗАЦИЯ ---
document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const key = document.getElementById('reg-key').value.trim();
    let role = key === KEY_DOCTOR ? 'doctor' : (key === KEY_ADMIN ? 'admin' : 'patient');
    
    try {
        isRegistering = true;
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), { email, role, registrationDate: new Date().toLocaleDateString('ru-RU') });
        showToast("Регистрация успешна! Загрузка...");
        setTimeout(() => window.location.reload(), 1000); 
    } catch (e) { 
        showToast("Ошибка: " + e.message, "error"); 
        isRegistering = false; 
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .catch(e => document.getElementById('auth-message').textContent = "Ошибка: " + e.message);
});

onAuthStateChanged(auth, async (user) => {
    if (isRegistering) return; 
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
                loadChatHistory(user.uid, 'chat-messages'); 
            }
            else if (role === 'doctor') { 
                docSec.style.display = 'flex'; 
                loadDoctorData(user.uid); 
                loadChatHistory(user.uid, 'chat-messages-doc'); 
            }
            else if (role === 'admin') { 
                admSec.style.display = 'flex'; 
                loadAdminData(); 
            }
        } else { 
            await signOut(auth); 
            alert("Аккаунт устарел. Зарегистрируйтесь заново."); 
        }
    } else {
        authSec.style.display = 'flex'; 
        patSec.style.display = 'none'; 
        docSec.style.display = 'none'; 
        admSec.style.display = 'none';
    }
});

// --- ПАНЕЛЬ АДМИНИСТРАТОРА ---
async function loadAdminData() {
    const usersList = document.getElementById('admin-users-list');
    const reqList = document.getElementById('admin-requests-list');
    const docList = document.getElementById('admin-doctors-list');
    usersList.innerHTML = ''; reqList.innerHTML = ''; docList.innerHTML = '';

    // Users
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.forEach(d => {
        const u = d.data();
        usersList.innerHTML += `<tr>
            <td><small>${d.id}</small></td><td>${u.email}</td><td>${u.role}</td>
            <td class="admin-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('users', '${d.id}', ${JSON.stringify(u).replace(/"/g, '&quot;')})">Изменить</button>
                <button class="btn btn-danger btn-sm" onclick="adminDelete('users', '${d.id}')">Удалить</button>
            </td></tr>`;
    });

    // Requests
    const reqSnap = await getDocs(collection(db, "requests"));
    reqSnap.forEach(d => {
        const r = d.data();
        reqList.innerHTML += `<tr>
            <td><small>${d.id}</small></td><td>${r.fullName}</td><td>${r.reason}</td><td>${r.status}</td>
            <td class="admin-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('requests', '${d.id}', ${JSON.stringify(r).replace(/"/g, '&quot;')})">Изменить</button>
                <button class="btn btn-danger btn-sm" onclick="adminDelete('requests', '${d.id}')">Удалить</button>
            </td></tr>`;
    });

    // Doctors
    const docSnap = await getDocs(collection(db, "doctors"));
    docSnap.forEach(d => {
        const docData = d.data();
        docList.innerHTML += `<tr>
            <td><small>${d.id}</small></td><td>${docData.fullName || '-'}</td><td>${docData.phone || '-'}</td><td>${docData.experience || '-'}</td>
            <td class="admin-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('doctors', '${d.id}', ${JSON.stringify(docData).replace(/"/g, '&quot;')})">Изменить</button>
                <button class="btn btn-danger btn-sm" onclick="adminDelete('doctors', '${d.id}')">Удалить</button>
            </td></tr>`;
    });
}

document.querySelectorAll('#admin-section .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#admin-section .nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#admin-section .view-section').forEach(v => v.classList.remove('active-view'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active-view');
    });
});

window.adminDelete = async (collectionName, id) => {
    if(!confirm(`Удалить запись из ${collectionName}?`)) return;
    try {
        await deleteDoc(doc(db, collectionName, id));
        showToast("Запись удалена");
        loadAdminData();
    } catch(e) { showToast("Ошибка удаления", "error"); }
};

window.openEditModal = (collectionName, docId, data) => {
    currentEditContext = { collectionName, docId };
    const formFields = document.getElementById('edit-form-fields');
    formFields.innerHTML = '';
    
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null) continue; // Пропускаем массивы/объекты
        formFields.innerHTML += `
            <div class="form-group">
                <label>${key}</label>
                <input type="text" id="edit-${key}" value="${value || ''}" ${key === 'role' || key === 'email' ? 'readonly' : ''}>
            </div>
        `;
    }
    document.getElementById('edit-modal').classList.add('active');
};

window.closeEditModal = () => document.getElementById('edit-modal').classList.remove('active');

document.getElementById('save-edit-btn').addEventListener('click', async () => {
    if (!currentEditContext) return;
    const { collectionName, docId } = currentEditContext;
    const updatedData = {};
    
    document.querySelectorAll('#edit-form-fields input').forEach(input => {
        if (input.readOnly) return;
        const key = input.id.replace('edit-', '');
        updatedData[key] = input.value;
    });

    try {
        await updateDoc(doc(db, collectionName, docId), updatedData);
        showToast("Данные обновлены!");
        closeEditModal();
        loadAdminData();
    } catch (e) { showToast("Ошибка сохранения: " + e.message, "error"); }
});

document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));

// --- ЛОГИКА ВРАЧА ---
async function loadDoctorData(uid) {
    await loadProfile(uid); 
    await loadPatients(uid); 
    await loadSchedule(uid); 
    await loadRequests();
}

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
    const file = e.target.files[0]; if (!file) return;
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

async function loadPatients(doctorId) {
    currentPatients = [];
    const snap = await getDocs(collection(db, "doctors", doctorId, "patients"));
    snap.forEach(d => currentPatients.push({ id: d.id, ...d.data() }));
    
    const tbody = document.getElementById('patients-list'); 
    tbody.innerHTML = '';
    currentPatients.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.snils || '-'}</td><td>${p.dob || '-'}</td><td>${p.symptoms}</td>
            <td><span class="action-link" onclick="openPatientModal('${p.id}')">Открыть карту</span>
            <span class="action-link danger" onclick="deletePatient('${p.id}')">Удалить</span></td></tr>`;
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
    loadPatients(auth.currentUser.uid); showToast("Добавлено");
});

window.deletePatient = async (id) => {
    if(confirm("Удалить пациента?")) { 
        await deleteDoc(doc(db, "doctors", auth.currentUser.uid, "patients", id)); 
        loadPatients(auth.currentUser.uid); 
    }
};

async function loadRequests() {
    const tbody = document.getElementById('requests-list'); tbody.innerHTML = '';
    const snap = await getDocs(query(collection(db, "requests"), where("status", "==", "pending")));
    snap.forEach(d => {
        const r = d.data();
        tbody.innerHTML += `<tr><td>${r.fullName}</td><td>${r.dob}</td><td>${r.snils}</td><td>${r.city}</td><td>${r.reason}</td>
            <td><button class="btn btn-primary" onclick="acceptRequest('${d.id}', '${r.patientId}', '${r.fullName}', '${r.reason}')">Принять</button></td>`;
    });
}

window.acceptRequest = async (reqId, patientId, name, reason) => {
    await addDoc(collection(db, "doctors", auth.currentUser.uid, "patients"), { patientId, name, symptoms: reason });
    await updateDoc(doc(db, "requests", reqId), { status: 'accepted', doctorId: auth.currentUser.uid });
    showToast("Пациент добавлен в базу"); loadRequests(); loadPatients(auth.currentUser.uid);
};

document.getElementById('add-schedule-btn').addEventListener('click', async () => {
    const sel = document.getElementById('s-patient');
    await addDoc(collection(db, "doctors", auth.currentUser.uid, "schedule"), {
        patientId: sel.value, patientName: sel.options[sel.selectedIndex]?.dataset.name,
        date: document.getElementById('s-date').value, time: document.getElementById('s-time').value, 
        reason: document.getElementById('s-reason').value
    });
    loadSchedule(auth.currentUser.uid); showToast("Записан");
});

async function loadSchedule(doctorId) {
    currentSchedule = []; 
    const tbody = document.getElementById('schedule-list'); tbody.innerHTML = '';
    const snap = await getDocs(collection(db, "doctors", doctorId, "schedule"));
    let schedArray = []; snap.forEach(d => schedArray.push({ id: d.id, ...d.data() }));
    schedArray.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
    schedArray.forEach(s => {
        currentSchedule.push(s); 
        tbody.innerHTML += `<tr><td>${s.date}</td><td>${s.time}</td><td>${s.patientName}</td><td>${s.reason || '-'}</td><td><span class="action-link danger" onclick="deleteSchedule('${s.id}')">Отменить</span></td></tr>`;
    });
}

window.deleteSchedule = async (id) => {
    await deleteDoc(doc(db, "doctors", auth.currentUser.uid, "schedule", id)); 
    loadSchedule(auth.currentUser.uid);
};

document.getElementById('doctor-logout-btn').addEventListener('click', () => signOut(auth));

window.openPatientModal = (id) => {
    const p = currentPatients.find(x => x.id === id); if (!p) return;
    currentModalPatientId = id;
    document.getElementById('modal-patient-name').textContent = p.name;
    document.getElementById('modal-patient-symptoms').textContent = p.symptoms;
    document.getElementById('ai-prescription-text').value = p.prescription || '';
    document.getElementById('patient-modal').classList.add('active');
};

window.closePatientModal = () => document.getElementById('patient-modal').classList.remove('active');

document.getElementById('generate-prescription-btn').addEventListener('click', async () => {
    const p = currentPatients.find(x => x.id === currentModalPatientId);
    const btn = document.getElementById('generate-prescription-btn'); 
    const textarea = document.getElementById('ai-prescription-text');
    btn.textContent = "Генерация..."; btn.disabled = true; textarea.value = "ИИ анализирует симптомы...";
    try {
        const aiReply = await callAI([{ role: "system", content: "Ты медицинский ассистент." }, { role: "user", content: `Пациент: ${p.name}, жалобы: ${p.symptoms}. Напиши краткий план лечения.` }]);
        textarea.value = aiReply;
    } catch (e) { textarea.value = "Ошибка: " + e.message; } 
    finally { btn.textContent = "Сгенерировать через ИИ"; btn.disabled = false; }
});

document.getElementById('save-prescription-btn').addEventListener('click', async () => {
    const text = document.getElementById('ai-prescription-text').value;
    await updateDoc(doc(db, "doctors", auth.currentUser.uid, "patients", currentModalPatientId), { prescription: text });
    showToast("Назначение сохранено"); closePatientModal(); loadPatients(auth.currentUser.uid);
});

// --- ПАЦИЕНТ И ЧАТЫ ---
document.getElementById('submit-request-btn').addEventListener('click', async () => {
    const user = auth.currentUser; if(!user) return;
    const req = { 
        patientId: user.uid, 
        fullName: document.getElementById('p-fullname').value, 
        dob: document.getElementById('p-dob').value, 
        snils: document.getElementById('p-snils').value, 
        policy: document.getElementById('p-policy').value, 
        city: document.getElementById('p-city').value, 
        reason: document.getElementById('p-reason').value, 
        status: 'pending', doctorId: null 
    };
    if (!req.fullName || !req.reason) return showToast("Заполните ФИО и причину", "error");
    await addDoc(collection(db, "requests"), req); 
    showToast("Заявка отправлена врачу!"); 
    document.getElementById('p-reason').value = '';
});

document.getElementById('patient-logout-btn').addEventListener('click', () => signOut(auth));

async function saveChatMessage(userId, text, sender) {
    await setDoc(doc(db, "users", userId), { chatHistory: arrayUnion({ text, sender }) }, { merge: true });
}

async function loadChatHistory(userId, containerId) {
    const container = document.getElementById(containerId);
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists() && userDoc.data().chatHistory) {
        container.innerHTML = '';
        userDoc.data().chatHistory.forEach(msg => {
            container.innerHTML += `<div class="message ${msg.sender === 'user' ? 'user-message' : 'bot-message'}">${msg.text}</div>`;
        });
    }
}

document.getElementById('chat-toggle-btn').onclick = () => document.getElementById('chat-window').classList.toggle('hidden');
document.getElementById('close-chat-btn').onclick = () => document.getElementById('chat-window').classList.add('hidden');
document.getElementById('send-msg-btn').onclick = async () => {
    const input = document.getElementById('chat-input'); 
    const msgs = document.getElementById('chat-messages'); 
    const user = auth.currentUser;
    if(!input.value || !user) return;
    
    const text = input.value; 
    msgs.innerHTML += `<div class="message user-message">${text}</div>`; 
    input.value = ''; 
    msgs.innerHTML += `<div class="message bot-message">Анализирую...</div>`;
    saveChatMessage(user.uid, text, 'user');
    
    try {
        const reply = await callAI([{ role: "system", content: "Ты вежливый медицинский ассистент." }, { role: "user", content: text }]);
        msgs.lastChild.remove(); 
        msgs.innerHTML += `<div class="message bot-message">${reply}</div>`; 
        saveChatMessage(user.uid, reply, 'bot');
    } catch(e) { 
        msgs.lastChild.remove(); 
        msgs.innerHTML += `<div class="message bot-message">${e.message}</div>`; 
    }
};

document.getElementById('chat-toggle-btn-doc').onclick = () => document.getElementById('chat-window-doc').classList.toggle('hidden');
document.getElementById('close-chat-btn-doc').onclick = () => document.getElementById('chat-window-doc').classList.add('hidden');
document.getElementById('send-msg-btn-doc').onclick = async () => {
    const input = document.getElementById('chat-input-doc'); 
    const msgs = document.getElementById('chat-messages-doc'); 
    const user = auth.currentUser;
    if(!input.value || !user) return;
    
    const text = input.value; 
    msgs.innerHTML += `<div class="message user-message">${text}</div>`; 
    input.value = ''; 
    msgs.innerHTML += `<div class="message bot-message">Думаю...</div>`;
    saveChatMessage(user.uid, text, 'user');
    
    let context = "Пациенты:\n"; 
    currentPatients.forEach(p => context += `- ${p.name} (${p.symptoms})\n`);
    
    try {
        const reply = await callAI([{ role: "system", content: `Ты ассистент врача. Данные: ${context}` }, { role: "user", content: text }]);
        msgs.lastChild.remove(); 
        msgs.innerHTML += `<div class="message bot-message">${reply}</div>`; 
        saveChatMessage(user.uid, reply, 'bot');
    } catch(e) { 
        msgs.lastChild.remove(); 
        msgs.innerHTML += `<div class="message bot-message">${e.message}</div>`; 
    }
};
