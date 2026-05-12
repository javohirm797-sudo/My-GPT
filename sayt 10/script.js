// ===== DOM Elements =====
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const messagesWrapper = document.getElementById('messagesWrapper');
const welcomeScreen = document.getElementById('welcomeScreen');
const typingIndicator = document.getElementById('typingIndicator');
const chatContainer = document.getElementById('chatContainer');
const newChatBtn = document.getElementById('newChatBtn');
const historyList = document.getElementById('historyList');



// Chat History State
let currentChatId = Date.now().toString();
let chatHistory = JSON.parse(localStorage.getItem('myGptChats')) || {};
let messages = [];

// Initialize marked.js with highlight.js for code rendering
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    breaks: true,
    gfm: true
});

// Auto-resize textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value.trim().length > 0) {
        sendBtn.removeAttribute('disabled');
        sendBtn.classList.add('active');
    } else {
        sendBtn.setAttribute('disabled', 'true');
        sendBtn.classList.remove('active');
    }
});

// Handle Enter key (Enter to send, Shift+Enter for new line)
userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if(this.value.trim().length > 0) {
            sendMessage();
        }
    }
});

// Sidebar Toggle (Mobile)
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar() {
    sidebar.classList.add('active');
    if(sidebarOverlay) sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // scroll bloklanadi
}

function closeSidebar() {
    sidebar.classList.remove('active');
    if(sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if(openSidebarBtn) openSidebarBtn.addEventListener('click', openSidebar);
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);


// New Chat
newChatBtn.addEventListener('click', startNewChat);

function startNewChat() {
    currentChatId = Date.now().toString();
    messages = [];
    messagesWrapper.innerHTML = '';
    messagesWrapper.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.setAttribute('disabled', 'true');
    
    // On mobile, close sidebar after clicking new chat
    if(window.innerWidth <= 768) {
        closeSidebar();
    }
}

// Send Message
sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Hide welcome screen on first message
    if (messages.length === 0) {
        welcomeScreen.style.display = 'none';
        messagesWrapper.style.display = 'flex';
        
        // Save to history list
        saveToHistoryList(text);
    }

    // Add User Message
    addMessageToUI('user', text);
    messages.push({ role: 'user', content: text });
    
    // Clear Input
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.setAttribute('disabled', 'true');
    sendBtn.classList.remove('active');

    // Show typing indicator
    typingIndicator.style.display = 'flex';
    scrollToBottom();

    try {
        // Prepare request to Pollinations API
        const systemMessage = { 
            role: "system", 
            content: "Sen My GPT, aqlli sun'iy intellektsan. Javoblaringni har doim o'zbek tilida va faqat matn ko'rinishida ber. Hech qanday dasturlash kodlarini (HTML, CSS, JS, Python va h.k.) yozma. Savollarga faqat matnli tushuntirishlar bilan javob ber." 
        };
        const apiMessages = [systemMessage, ...messages];

        let response;
        try {
            response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: 'openai',
                    json: false
                })
            });
        } catch (e) {
            // Fallback: Agar POST ishlamasa, GET ishlatamiz (oxirgi xabar uchun)
            const lastMsg = apiMessages[apiMessages.length - 1].content;
            response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(lastMsg)}?model=openai`);
        }

        if (!response.ok) throw new Error('API Error');

        const data = await response.text();
        
        // Hide typing indicator
        typingIndicator.style.display = 'none';
        
        if (!data || data.trim().length === 0) {
            throw new Error('Empty response');
        }

        // Add Bot Message
        addMessageToUI('bot', data);
        messages.push({ role: 'assistant', content: data });

        // Save state to local storage
        saveCurrentChat();

    } catch (error) {
        typingIndicator.style.display = 'none';
        addMessageToUI('bot', "Kechirasiz, ulanishda xatolik bo'ldi. Iltimos, yana bir bor urinib ko'ring yoki internetni tekshiring.");
        console.error('My GPT Error:', error);
    }

}

function addMessageToUI(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    const isUser = sender === 'user';
    
    // Parse markdown for bot messages
    let formattedText = isUser ? escapeHTML(text).replace(/\n/g, '<br>') : marked.parse(text);

    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="avatar ${isUser ? 'user-avatar-msg' : 'bot-avatar-msg'}">
                ${isUser ? '<img src="https://ui-avatars.com/api/?name=User&background=random" alt="User">' : '✨'}
            </div>
            <div class="text-content">
                ${formattedText}
            </div>
        </div>
    `;

    messagesWrapper.appendChild(messageDiv);
    
    // Add copy buttons and language labels to code blocks
    if (!isUser) {
        const blocks = messageDiv.querySelectorAll('pre');
        blocks.forEach((block) => {
            // Container for button
            const controls = document.createElement('div');
            controls.className = 'code-controls';
            
            // Get language class if exists
            const codeEl = block.querySelector('code');
            const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
            const langName = langClass ? langClass.replace('language-', '').toUpperCase() : '';

            // Language label
            if (langName) {
                const langLabel = document.createElement('span');
                langLabel.className = 'lang-label';
                langLabel.innerText = langName;
                block.prepend(langLabel);
            }

            // Copy button
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            btn.onclick = () => {
                const code = codeEl.innerText;
                navigator.clipboard.writeText(code);
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                btn.style.backgroundColor = '#34a853';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                    btn.style.backgroundColor = '';
                }, 2000);
            };
            block.appendChild(btn);
        });
    }

    scrollToBottom();
}


function scrollToBottom() {
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

// Utility to escape HTML to prevent XSS for user messages
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Save chat history functionality
function saveToHistoryList(firstMessage) {
    const title = firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
    
    chatHistory[currentChatId] = {
        title: title,
        messages: messages
    };
    
    updateHistoryUI();
}

function saveCurrentChat() {
    if (chatHistory[currentChatId]) {
        chatHistory[currentChatId].messages = messages;
        localStorage.setItem('myGptChats', JSON.stringify(chatHistory));
    }
}

function updateHistoryUI() {
    historyList.innerHTML = '';
    const keys = Object.keys(chatHistory).reverse(); // Newest first
    
    keys.forEach(id => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fa-regular fa-message"></i> ${chatHistory[id].title}`;
        li.onclick = () => loadChat(id);
        historyList.appendChild(li);
    });
}

function loadChat(id) {
    if (!chatHistory[id]) return;
    
    currentChatId = id;
    messages = chatHistory[id].messages || [];
    
    messagesWrapper.innerHTML = '';
    welcomeScreen.style.display = 'none';
    messagesWrapper.style.display = 'flex';
    
    // Restore messages
    messages.forEach(msg => {
        addMessageToUI(msg.role === 'user' ? 'user' : 'bot', msg.content);
    });
    
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
}

// Initial UI setup
updateHistoryUI();

// Auth Modal Logic
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const sidebarAuthBtn = document.getElementById('sidebarAuthBtn');
const topbarAuthBtn = document.getElementById('topbarAuthBtn');
const switchAuthMode = document.getElementById('switchAuthMode');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const nameGroup = document.getElementById('nameGroup');
const authSwitchText = document.getElementById('authSwitchText');
const authForm = document.getElementById('authForm');
const authError = document.getElementById('authError');
let isLoginMode = false;

// Check if user is already registered
const savedAccount = JSON.parse(localStorage.getItem('myGptAccount'));
if(savedAccount) {
    document.querySelector('.user-name').innerText = savedAccount.name;
    document.querySelector('.user-plan').innerText = "My GPT Premium";
}

function openModal() {
    authModal.style.display = 'flex';
    authError.style.display = 'none';
    authForm.reset();
}

function closeModal() {
    authModal.style.display = 'none';
}

sidebarAuthBtn.addEventListener('click', openModal);
topbarAuthBtn.addEventListener('click', openModal);
closeAuthModal.addEventListener('click', closeModal);

// Close when clicking outside modal content
window.addEventListener('click', (e) => {
    if (e.target === authModal) {
        closeModal();
    }
});

switchAuthMode.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    authError.style.display = 'none';
    
    if (isLoginMode) {
        document.querySelector('.modal-header h2').innerText = 'Tizimga kirish';
        document.querySelector('.modal-header p').innerText = "Hisobingizga kirish orqali chatni davom ettiring";
        nameGroup.style.display = 'none';
        document.getElementById('fullName').removeAttribute('required');
        authSubmitBtn.innerText = 'Kirish';
        authSwitchText.innerText = "Hisobingiz yo'qmi?";
        switchAuthMode.innerText = "Ro'yxatdan o'tish";
    } else {
        document.querySelector('.modal-header h2').innerText = "Ro'yxatdan o'tish";
        document.querySelector('.modal-header p').innerText = "My GPT imkoniyatlaridan to'liq foydalanish uchun hisob qo'shing";
        nameGroup.style.display = 'flex';
        document.getElementById('fullName').setAttribute('required', 'true');
        authSubmitBtn.innerText = "Ro'yxatdan o'tish";
        authSwitchText.innerText = "Allaqachon hisobingiz bormi?";
        switchAuthMode.innerText = "Tizimga kirish";
    }
});

// Fast Mode Logic
const fastModeBtn = document.getElementById('fastModeBtn');
let isFastMode = false;

if(fastModeBtn) {
    fastModeBtn.addEventListener('click', () => {
        isFastMode = !isFastMode;
        if(isFastMode) {
            fastModeBtn.style.backgroundColor = '#1a73e8';
            fastModeBtn.style.color = 'white';
            fastModeBtn.innerText = 'Tezkor faol';
        } else {
            fastModeBtn.style.backgroundColor = '';
            fastModeBtn.style.color = '';
            fastModeBtn.innerText = 'Быстрая';
        }
    });
}

// Voice Recognition Logic
const micBtn = document.getElementById('micBtn');
let isRecording = false;
let recognition;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'uz-UZ'; // O'zbek tili uchun
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
        isRecording = true;
        micBtn.style.color = '#ef4444'; // Qizil rang
        micBtn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
        
        // Input o'zgarishini bildirish (tugmani yashil qilish uchun)
        const inputEvent = new Event('input', { bubbles: true });
        userInput.dispatchEvent(inputEvent);
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error', event.error);
        stopRecording();
    };

    recognition.onend = function() {
        stopRecording();
    };
} else {
    console.warn('Speech Recognition API brauzeringizda ishlamaydi.');
}

function stopRecording() {
    isRecording = false;
    micBtn.style.color = '';
    micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
}

if(micBtn) {
    micBtn.addEventListener('click', () => {
        if (!recognition) {
            alert("Kechirasiz, brauzeringiz ovozli kiritishni qo'llab-quvvatlamaydi (Chrome yoki Edge dan foydalaning).");
            return;
        }
        
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
}


authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('email').value.trim();
    const passwordInput = document.getElementById('password').value;
    
    if (isLoginMode) {
        // Tizimga kirish tekshiruvi
        const savedAccount = JSON.parse(localStorage.getItem('myGptAccount'));
        
        if (savedAccount && savedAccount.email === emailInput && savedAccount.password === passwordInput) {
            // Muvaffaqiyatli
            authError.style.display = 'none';
            closeModal();
            document.querySelector('.user-name').innerText = savedAccount.name;
            document.querySelector('.user-plan').innerText = "My GPT Premium";
        } else {
            // Xato
            authError.innerText = "Elektron pochta yoki parol noto'g'ri!";
            authError.style.display = 'block';
        }
    } else {
        // Ro'yxatdan o'tish
        const nameInput = document.getElementById('fullName').value.trim();
        
        const accountData = {
            name: nameInput,
            email: emailInput,
            password: passwordInput
        };
        
        localStorage.setItem('myGptAccount', JSON.stringify(accountData));
        
        authError.style.display = 'none';
        closeModal();
        
        document.querySelector('.user-name').innerText = nameInput;
        document.querySelector('.user-plan').innerText = "My GPT Premium";
    }
});

// Upload File Logic
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const filePreviewWrapper = document.getElementById('filePreviewWrapper');

if(uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if(files.length > 0) {
            for(let i=0; i<files.length; i++) {
                const file = files[i];
                if(file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const div = document.createElement('div');
                        div.className = 'file-preview-item';
                        div.innerHTML = `
                            <img src="${event.target.result}" alt="preview">
                            <button class="remove-file-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
                        `;
                        filePreviewWrapper.appendChild(div);
                    };
                    reader.readAsDataURL(file);
                } else {
                    const div = document.createElement('div');
                    div.className = 'file-preview-item';
                    div.innerHTML = `
                        <i class="fa-solid fa-file-lines" style="font-size: 24px; color: #1a73e8;"></i>
                        <button class="remove-file-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
                    `;
                    filePreviewWrapper.appendChild(div);
                }
            }
        }
    });
}

// Extensions Menu Logic
const extensionsBtn = document.getElementById('extensionsBtn');
const extensionsMenu = document.getElementById('extensionsMenu');

if(extensionsBtn && extensionsMenu) {
    extensionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        extensionsMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if(!extensionsBtn.contains(e.target) && !extensionsMenu.contains(e.target)) {
            extensionsMenu.classList.remove('active');
        }
    });
}

// Menu Items Logic (Bottom Sheet)
function activateMode(mode) {
    let prefix = '';
    switch(mode) {
        case 'image': prefix = 'Создай изображение: '; break;
        case 'video': prefix = 'Создай видео: '; break;
        case 'music': prefix = 'Создай музыку: '; break;
        case 'canvas': prefix = 'Открой Canvas для: '; break;
        case 'research': prefix = 'Сделай Deep Research на тему: '; break;
        case 'education': prefix = 'Обучи меня теме: '; break;
    }
    
    const userInput = document.getElementById('userInput');
    userInput.value = prefix;
    userInput.focus();
    
    // Trigger input event to resize textarea and enable send button
    const inputEvent = new Event('input', { bubbles: true });
    userInput.dispatchEvent(inputEvent);
    
    // Yopish
    document.getElementById('extensionsMenu').classList.remove('active');
}

// Toggle logic
const personalAiToggle = document.getElementById('personalAiToggle');
if(personalAiToggle) {
    personalAiToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            console.log('Персональный ИИ включен');
        } else {
            console.log('Персональный ИИ выключен');
        }
    });
}

// ===== Language Switcher Logic =====
const translations = {
    ru: {
        newChat: 'Новый чат',
        historyTitle: 'Недавние',
        greeting: 'Здравствуйте!',
        question: 'С чего начнем?',
        chip1: 'Создать изображение',
        chip2: 'Создать музыку',
        chip3: 'Улучши мой день',
        chip4: 'Напишите что-нибудь',
        placeholder: 'Спросите My GPT',
        disclaimer: 'My GPT может допускать ошибки. Проверяйте важную информацию.',
        fastBtn: 'Быстрая',
        loginTitle: "Ro'yxatdan o'tish",
        loginSubtitle: "My GPT imkoniyatlaridan to'liq foydalanish uchun hisob qo'shing",
        nameLabel: 'Ism va familiya',
        emailLabel: 'Электронная почта',
        passLabel: 'Пароль',
        submitBtn: "Ro'yxatdan o'tish",
        switchText: 'Allaqachon hisobingiz bormi?',
        switchLink: 'Tizimga kirish',
        authPrompt: "Kirish / Ro'yxatdan o'tish",
        authSub: "Hisobingiz yo'qmi?",
        menuImage: 'Создать изображение',
        menuVideo: 'Создать видео',
        menuMusic: 'Создание музыки',
        menuCanvas: 'Canvas',
        menuResearch: 'Deep Research',
        menuEducation: 'Обучение',
        expTitle: 'Экспериментальные функции',
        personalAI: 'Персональный ИИ',
        personalAISub: 'Чат может быть персонализирован',
    },
    uz: {
        newChat: "Yangi chat",
        historyTitle: "So'nggi chatlar",
        greeting: 'Assalomu alaykum!',
        question: 'Bugun nimadan boshlaymiz?',
        chip1: 'Rasm yaratish',
        chip2: 'Musiqa yaratish',
        chip3: 'Kunimi yaxshila',
        chip4: 'Nimadir yoz',
        placeholder: "My GPT dan so'rang",
        disclaimer: "My GPT xato qilishi mumkin. Muhim ma'lumotlarni tekshiring.",
        fastBtn: 'Tezkor',
        loginTitle: "Ro'yxatdan o'tish",
        loginSubtitle: "My GPT imkoniyatlaridan to'liq foydalanish uchun hisob qo'shing",
        nameLabel: 'Ism va familiya',
        emailLabel: 'Elektron pochta',
        passLabel: 'Parol',
        submitBtn: "Ro'yxatdan o'tish",
        switchText: 'Allaqachon hisobingiz bormi?',
        switchLink: 'Tizimga kirish',
        authPrompt: "Kirish / Ro'yxatdan o'tish",
        authSub: "Hisobingiz yo'qmi?",
        menuImage: 'Rasm yaratish',
        menuVideo: 'Video yaratish',
        menuMusic: "Musiqa yaratish",
        menuCanvas: 'Canvas',
        menuResearch: 'Chuqur tadqiqot',
        menuEducation: "O'rganish",
        expTitle: "Tajriba funksiyalari",
        personalAI: "Shaxsiy AI",
        personalAISub: "Chat shaxsiylashtirilishi mumkin",
    }
};



let currentLang = 'ru';

function setEl(selector, text, isId = false) {
    const el = isId ? document.getElementById(selector) : document.querySelector(selector);
    if(el) el.innerText = text;
}

function applyLanguage(lang) {
    const t = translations[lang];

    // Sidebar
    setEl('newChatText', t.newChat, true);
    setEl('.history-title', t.historyTitle);

    // Welcome Screen
    setEl('.greeting', t.greeting);
    setEl('.question', t.question);

    // Chips
    const chips = document.querySelectorAll('.gemini-chip .text');
    const chipTexts = [t.chip1, t.chip2, t.chip3, t.chip4];
    chips.forEach((chip, i) => { if(chipTexts[i]) chip.innerText = chipTexts[i]; });

    // Input placeholder
    const userInputEl = document.getElementById('userInput');
    if(userInputEl) userInputEl.placeholder = t.placeholder;

    // Disclaimer
    setEl('.disclaimer', t.disclaimer);

    // Fast button
    const fastBtnEl = document.getElementById('fastModeBtn');
    if(fastBtnEl && !isFastMode) fastBtnEl.innerText = t.fastBtn;

    // Auth modal — faqat mavjud bo'lsa
    setEl('.modal-header h2', t.loginTitle);
    setEl('.modal-header p', t.loginSubtitle);
    setEl('label[for="fullName"]', t.nameLabel);
    setEl('label[for="email"]', t.emailLabel);
    setEl('label[for="password"]', t.passLabel);
    setEl('authSubmitBtn', t.submitBtn, true);
    setEl('authSwitchText', t.switchText, true);
    setEl('switchAuthMode', t.switchLink, true);

    // Sidebar auth — faqat login bo'lmagan bo'lsa
    const acc = localStorage.getItem('myGptAccount');
    if(!acc) {
        setEl('.user-name', t.authPrompt);
        setEl('.user-plan', t.authSub);
    }

    // Bottom sheet menu items — icon va badge saqlab matn almashtirish
    const menuItems = document.querySelectorAll('.menu-item');
    const menuTexts = [t.menuImage, t.menuVideo, t.menuMusic, t.menuCanvas, t.menuResearch, t.menuEducation];
    menuItems.forEach((item, i) => {
        const icon = item.querySelector('i');
        const badge = item.querySelector('.badge');
        item.innerText = '';
        if(icon) item.appendChild(icon);
        item.appendChild(document.createTextNode(' ' + (menuTexts[i] || '')));
        if(badge) item.appendChild(badge);
    });

    // Experimental section title
    const sectionTitle = document.querySelector('.menu-section-title');
    if(sectionTitle) {
        const labsBadge = sectionTitle.querySelector('.badge');
        sectionTitle.innerText = t.expTitle + ' ';
        if(labsBadge) sectionTitle.appendChild(labsBadge);
    }

    setEl('.toggle-text h4', t.personalAI);
    setEl('.toggle-text p', t.personalAISub);

    // Lang button label update
    const langLabelEl = document.getElementById('langLabel');
    if(langLabelEl) langLabelEl.innerText = lang === 'ru' ? 'RU' : "O'Z";
}

const langToggleBtnEl = document.getElementById('langToggleBtn');
if(langToggleBtnEl) {
    langToggleBtnEl.addEventListener('click', () => {
        currentLang = currentLang === 'ru' ? 'uz' : 'ru';
        applyLanguage(currentLang);
    });
}

// ===== Sidebar Section Buttons =====
const myContentBtn = document.getElementById('myContentBtn');
const myBotsBtn = document.getElementById('myBotsBtn');
const notebooksBtn = document.getElementById('notebooksBtn');
const newNotebookBtn = document.getElementById('newNotebookBtn');
const sidebarSearch = document.getElementById('sidebarSearch');

if(myContentBtn) {
    myContentBtn.addEventListener('click', () => {
        const t = currentLang === 'uz' ? 'Mening kontent sahifam' : 'Мой контент';
        showInfoPanel(t, currentLang === 'uz'
            ? "Bu bo'limda siz saqlagan barcha suhbatlar, rasmlar va hujjatlar bo'ladi."
            : "В этом разделе будут все ваши сохранённые чаты, изображения и документы.");
    });
}

if(myBotsBtn) {
    myBotsBtn.addEventListener('click', () => {
        const t = currentLang === 'uz' ? 'My GPT botlar' : 'My GPT боты';
        showInfoPanel(t, currentLang === 'uz'
            ? "Bu yerda siz yaratgan maxsus AI botlaringiz ko'rsatiladi."
            : "Здесь отображаются ваши персональные AI-боты.");
    });
}

if(notebooksBtn) {
    notebooksBtn.addEventListener('click', () => {
        const t = currentLang === 'uz' ? 'Daftarlar' : 'Блокноты';
        showInfoPanel(t, currentLang === 'uz'
            ? "Daftarlaringiz: eslatmalar va saqlanган g'oyalar."
            : "Ваши блокноты: заметки и сохранённые идеи.");
    });
}

if(newNotebookBtn) {
    newNotebookBtn.addEventListener('click', () => {
        const name = prompt(currentLang === 'uz' ? "Yangi daftar nomi:" : "Название нового блокнота:");
        if(name && name.trim()) {
            alert((currentLang === 'uz' ? "Daftar yaratildi: " : "Блокнот создан: ") + name.trim());
        }
    });
}

// Info Panel helper — chat container da chiroyli xabar ko'rsatish
function showInfoPanel(title, desc) {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const messagesWrapper = document.getElementById('messagesWrapper');
    if(welcomeScreen) {
        welcomeScreen.querySelector('.greeting').innerText = title;
        welcomeScreen.querySelector('.question').innerText = desc;
        welcomeScreen.style.display = 'flex';
    }
    if(messagesWrapper) messagesWrapper.style.display = 'none';
    
    // Sidebar yopish (mobil)
    const sidebar = document.getElementById('sidebar');
    if(window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
}

// Sidebar Search Filter
if(sidebarSearch) {
    sidebarSearch.addEventListener('input', () => {
        const val = sidebarSearch.value.toLowerCase();
        const items = document.querySelectorAll('#historyList li');
        items.forEach(item => {
            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(val) ? '' : 'none';
        });
    });
}
