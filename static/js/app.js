/* ============================================
   BOT MANAGER - MAIN APPLICATION SCRIPT
   Version: 2.0.0
   ============================================ */

// Application State
const AppState = {
    currentBot: null,
    currentSection: 'dashboard',
    bots: [],
    messages: {},
    theme: localStorage.getItem('theme') || 'light',
    apiStatus: 'checking'
};

// DOM Elements
const DOM = {
    // Sidebar
    sidebar: null,
    themeToggleBtn: null,
    apiStatusIndicator: null,
    botListContainer: null,
    searchInput: null,
    
    // Main Content
    mainContent: null,
    contentSections: null,
    
    // Bot Cards
    botsGrid: null,
    
    // Chat
    chatContainer: null,
    chatMessages: null,
    chatInput: null,
    sendBtn: null,
    typingIndicator: null,
    charCount: null,
    
    // Modals
    createBotModal: null,
    editBotModal: null,
    
    // Toast Container
    toastContainer: null
};

// API Configuration
const API = {
    baseURL: 'http://localhost:5000/api',
    endpoints: {
        bots: '/bots',
        chat: '/chat',
        analytics: '/analytics'
    },
    
    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            this.showToast('API Error', 'Failed to connect to server', 'error');
            throw error;
        }
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeDOM();
    initializeEventListeners();
    loadInitialData();
    checkAPIStatus();
    applyTheme();
});

// DOM Initialization
function initializeDOM() {
    // Sidebar Elements
    DOM.sidebar = document.querySelector('.sidebar');
    DOM.themeToggleBtn = document.querySelector('.theme-toggle button');
    DOM.apiStatusIndicator = document.querySelector('.api-status .status-dot');
    DOM.botListContainer = document.querySelector('.bot-list');
    DOM.searchInput = document.querySelector('.search-container input');
    
    // Main Content
    DOM.mainContent = document.querySelector('.main-content');
    DOM.contentSections = document.querySelectorAll('.content-section');
    
    // Bot Cards
    DOM.botsGrid = document.querySelector('.bots-grid');
    
    // Chat Elements
    DOM.chatContainer = document.querySelector('.chat-container');
    DOM.chatMessages = document.querySelector('.chat-messages');
    DOM.chatInput = document.querySelector('.chat-input-container textarea');
    DOM.sendBtn = document.querySelector('.btn-send');
    DOM.typingIndicator = document.querySelector('.typing-indicator');
    DOM.charCount = document.querySelector('.char-count');
    
    // Modals
    DOM.createBotModal = document.getElementById('createBotModal');
    DOM.editBotModal = document.getElementById('editBotModal');
    
    // Toast Container
    DOM.toastContainer = document.querySelector('.toast-container');
    if (!DOM.toastContainer) {
        DOM.toastContainer = document.createElement('div');
        DOM.toastContainer.className = 'toast-container';
        document.body.appendChild(DOM.toastContainer);
    }
}

// Event Listeners
function initializeEventListeners() {
    // Theme Toggle
    if (DOM.themeToggleBtn) {
        DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });
    
    // Bot List
    if (DOM.botListContainer) {
        DOM.botListContainer.addEventListener('click', handleBotSelection);
    }
    
    // Search
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debounce(searchBots, 300));
    }
    
    // Create Bot Button
    const createBotBtn = document.querySelector('.btn-create-bot');
    if (createBotBtn) {
        createBotBtn.addEventListener('click', () => showModal('create'));
    }
    
    // Chat Input
    if (DOM.chatInput) {
        DOM.chatInput.addEventListener('input', updateCharCount);
        DOM.chatInput.addEventListener('keydown', handleChatInputKeydown);
    }
    
    // Send Button
    if (DOM.sendBtn) {
        DOM.sendBtn.addEventListener('click', sendMessage);
    }
    
    // Modal Close Buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.add('hidden');
        });
    });
    
    // Modal Overlay Click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });
    
    // Bot Form Submissions
    const createBotForm = document.getElementById('createBotForm');
    if (createBotForm) {
        createBotForm.addEventListener('submit', handleCreateBot);
    }
    
    const editBotForm = document.getElementById('editBotForm');
    if (editBotForm) {
        editBotForm.addEventListener('submit', handleEditBot);
    }
    
    // Range Inputs
    document.querySelectorAll('input[type="range"]').forEach(range => {
        range.addEventListener('input', updateRangeValue);
    });
}

// Theme Management
function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', AppState.theme);
    applyTheme();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', AppState.theme);
    
    if (DOM.themeToggleBtn) {
        const icon = DOM.themeToggleBtn.querySelector('i');
        const text = DOM.themeToggleBtn.querySelector('span');
        
        if (AppState.theme === 'dark') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Light Mode';
        } else {
            icon.className = 'fas fa-moon';
            text.textContent = 'Dark Mode';
        }
    }
}

// Section Navigation
function switchSection(sectionId) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });
    
    // Update active content section
    DOM.contentSections.forEach(section => {
        section.classList.toggle('active', section.id === `${sectionId}Section`);
    });
    
    AppState.currentSection = sectionId;
    
    // Load section-specific data
    switch(sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'chat':
            if (AppState.currentBot) {
                loadChatHistory(AppState.currentBot.id);
            }
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Bot Management
async function loadInitialData() {
    try {
        const bots = await API.request(API.endpoints.bots);
        AppState.bots = bots;
        renderBotList();
        renderBotCards();
        
        // Select first bot if available
        if (bots.length > 0 && !AppState.currentBot) {
            selectBot(bots[0]);
        }
    } catch (error) {
        console.error('Failed to load bots:', error);
    }
}

function renderBotList() {
    if (!DOM.botListContainer) return;
    
    DOM.botListContainer.innerHTML = '';
    
    if (AppState.bots.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="fas fa-robot"></i>
            <p>No bots created yet</p>
            <p class="small">Click "Create New Bot" to get started</p>
        `;
        DOM.botListContainer.appendChild(emptyState);
        return;
    }
    
    AppState.bots.forEach(bot => {
        const botItem = document.createElement('div');
        botItem.className = `bot-item ${AppState.currentBot?.id === bot.id ? 'active' : ''}`;
        botItem.dataset.botId = bot.id;
        
        botItem.innerHTML = `
            <div class="bot-avatar">${bot.name.charAt(0)}</div>
            <div class="bot-info">
                <div class="bot-name">${bot.name}</div>
                <div class="bot-meta">
                    <span class="status-dot ${bot.status === 'active' ? '' : '