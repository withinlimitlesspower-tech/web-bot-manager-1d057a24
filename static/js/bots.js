/* ============================================
   BOT MANAGER - COMPLETE JAVASCRIPT
   Version: 2.0.0 - FULL FUNCTIONALITY
   ============================================ */

// API Configuration
const API_CONFIG = {
    BASE_URL: 'https://api.example.com/v1',
    ENDPOINTS: {
        BOTS: '/bots',
        MESSAGES: '/messages',
        ANALYTICS: '/analytics'
    },
    HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

// State Management
const AppState = {
    currentBot: null,
    bots: [],
    messages: [],
    analytics: null,
    currentSection: 'dashboard',
    theme: localStorage.getItem('theme') || 'light',
    apiConnected: false
};

// DOM Elements Cache
const DOM = {
    // Layout
    appContainer: document.querySelector('.app-container'),
    sidebar: document.querySelector('.sidebar'),
    mainContent: document.querySelector('.main-content'),
    
    // Sidebar Elements
    btnCreateBot: document.querySelector('.btn-create-bot'),
    searchInput: document.querySelector('.search-container input'),
    botList: document.querySelector('.bot-list'),
    botCount: document.querySelector('.bot-count'),
    themeToggle: document.querySelector('.theme-toggle button'),
    apiStatus: document.querySelector('.api-status'),
    
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    
    // Content Sections
    contentSections: document.querySelectorAll('.content-section'),
    
    // Dashboard
    botsGrid: document.querySelector('.bots-grid'),
    
    // Chat
    chatHeader: document.querySelector('.chat-header'),
    chatMessages: document.querySelector('.chat-messages'),
    chatInput: document.querySelector('.chat-input-container textarea'),
    btnSend: document.querySelector('.btn-send'),
    typingIndicator: document.querySelector('.typing-indicator'),
    charCount: document.querySelector('.char-count'),
    
    // Analytics
    statsGrid: document.querySelector('.stats-grid'),
    chartsGrid: document.querySelector('.charts-grid'),
    
    // Modals
    modalOverlay: document.querySelector('.modal-overlay'),
    modal: document.querySelector('.modal'),
    modalClose: document.querySelector('.modal-close'),
    
    // Toast
    toastContainer: document.querySelector('.toast-container')
};

// Initialize Application
class BotManager {
    constructor() {
        this.init();
    }

    async init() {
        try {
            // Initialize theme
            this.initTheme();
            
            // Initialize event listeners
            this.initEventListeners();
            
            // Check API connection
            await this.checkApiConnection();
            
            // Load initial data
            await this.loadBots();
            await this.loadAnalytics();
            
            // Update UI
            this.updateBotList();
            this.updateDashboard();
            this.updateAnalytics();
            
            console.log('Bot Manager initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('Error', 'Failed to initialize application', 'error');
        }
    }

    // Theme Management
    initTheme() {
        document.documentElement.setAttribute('data-theme', AppState.theme);
        this.updateThemeToggleIcon();
    }

    toggleTheme() {
        AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', AppState.theme);
        localStorage.setItem('theme', AppState.theme);
        this.updateThemeToggleIcon();
    }

    updateThemeToggleIcon() {
        if (DOM.themeToggle) {
            const icon = DOM.themeToggle.querySelector('i');
            if (icon) {
                icon.className = AppState.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    }

    // Event Listeners
    initEventListeners() {
        // Theme toggle
        if (DOM.themeToggle) {
            DOM.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Navigation
        DOM.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });

        // Create bot button
        if (DOM.btnCreateBot) {
            DOM.btnCreateBot.addEventListener('click', () => this.showCreateBotModal());
        }

        // Search functionality
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener('input', (e) => this.filterBots(e.target.value));
        }

        // Chat input
        if (DOM.chatInput) {
            DOM.chatInput.addEventListener('input', (e) => this.updateCharCount(e.target.value));
            DOM.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Send message button
        if (DOM.btnSend) {
            DOM.btnSend.addEventListener('click', () => this.sendMessage());
        }

        // Modal close
        if (DOM.modalClose) {
            DOM.modalClose.addEventListener('click', () => this.hideModal());
        }

        if (DOM.modalOverlay) {
            DOM.modalOverlay.addEventListener('click', (e) => {
                if (e.target === DOM.modalOverlay) {
                    this.hideModal();
                }
            });
        }

        // Close toast on click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('toast-close')) {
                e.target.closest('.toast').remove();
            }
        });
    }

    // API Communication
    async checkApiConnection() {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
                method: 'GET',
                headers: API_CONFIG.HEADERS
            });
            
            AppState.apiConnected = response.ok;
            this.updateApiStatus();
            
            if (!response.ok) {
                throw new Error('API connection failed');
            }
        } catch (error) {
            AppState.apiConnected = false;
            this.updateApiStatus();
            console.warn('API connection check failed:', error);
        }
    }

    updateApiStatus() {
        if (DOM.apiStatus) {
            const dot = DOM.apiStatus.querySelector('.status-dot');
            const text = DOM.apiStatus.querySelector('span:last-child');
            
            if (AppState.apiConnected) {
                dot.style.background = 'var(--success-color)';
                text.textContent = 'API Connected';
            } else {
                dot.style.background = 'var(--danger-color)';
                text.textContent = 'API Disconnected';
            }
        }
    }

    async apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        const options = {
            method,
            headers: API_CONFIG.HEADERS
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            this.showToast('API Error', 'Failed to communicate with server', 'error');
            throw error;
        }
    }

    // Bot Management
    async loadBots() {
        try {
            const data = await this.apiRequest(API_CONFIG.ENDPOINTS.BOTS);
            AppState.bots = data.bots || [];
            this.updateBotCount();
        } catch (error) {
            // Fallback to mock data for demo
            AppState.bots = this.getMockBots();
            this.updateBotCount();
        }
    }

    async loadBotDetails(botId) {
        try {
            const data = await this.apiRequest(`${API_CONFIG.ENDPOINTS.BOTS}/${botId}`);
            AppState.currentBot = data;
            this.updateChatHeader();
            await this.loadMessages(botId);
        } catch (error) {
            // Fallback to mock data
            AppState.currentBot = AppState.bots.find(bot => bot.id === botId) || null;
            this.updateChatHeader();
            this.loadMockMessages(botId);
        }
    }

    async createBot(botData) {
        try {
            const data = await this.apiRequest(API_CONFIG.ENDPOINTS.BOTS, 'POST', botData);
            AppState.bots.push(data);
            this.updateBotList();
            this.updateDashboard();
            this.hideModal();
            this.showToast('Success', 'Bot created successfully', 'success');
            return data;
        } catch (error) {
            this.showToast('Error', 'Failed to create bot', 'error');
            throw error;
        }
    }

    async updateBot(botId, botData) {
        try {
            const data = await this.apiRequest(`${API_CONFIG.ENDPOINTS.BOTS}/${botId}`, 'PUT', botData);
            const index = AppState.bots.findIndex(bot => bot.id === botId