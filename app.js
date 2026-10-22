// Импортируем функции Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Индивидуальный firebaseConfig 
const firebaseConfig = {
  apiKey: "AIzaSyBp8WY8Q63pXT4tpb5_gUJCK54wbU4SnbQ",
  authDomain: "medpomoshnick.firebaseapp.com",
  projectId: "medpomoshnick",
  storageBucket: "medpomoshnick.firebasestorage.app",
  messagingSenderId: "606497722603",
  appId: "1:606497722603:web:8d3194cc687129be92aeae",
  measurementId: "G-9QS66EZR4C"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Получаем элементы со страницы
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const userEmailSpan = document.getElementById('user-email');
const authMessage = document.getElementById('auth-message');

// Функция для регистрации
signupBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    createUserWithEmailAndPassword(auth, email, password)
        .then(() => {
            authMessage.textContent = "Регистрация успешна!";
            authMessage.style.color = "green";
        })
        .catch((error) => {
            authMessage.textContent = "Ошибка: " + error.message;
            authMessage.style.color = "red";
        });
});

// Функция для входа
loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            authMessage.textContent = ""; // Очищаем сообщения об ошибках
        })
        .catch((error) => {
            authMessage.textContent = "Ошибка: " + error.message;
            authMessage.style.color = "red";
        });
});

// Следим за состоянием пользователя (вошел или вышел)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Если вошел
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        userEmailSpan.textContent = user.email;
        emailInput.value = "";
        passwordInput.value = "";
    } else {
        // Если вышел
        authSection.style.display = 'block';
        appSection.style.display = 'none';
    }
});

// Выход
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});