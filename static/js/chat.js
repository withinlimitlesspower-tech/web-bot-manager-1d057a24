/* ============================================
   BOT MANAGER - CHAT FUNCTIONALITY
   Version: 2.0.0
   ============================================ */

class ChatManager {
    constructor() {
        this.currentBot = null;
        this.messages = [];
        this.isTyping = false;
        this.apiBaseUrl = '/api';
        this.init();
    }

    /**
     * Initialize chat functionality
     */
    init() {
        this.bindEvents();
        this.loadInitialData();
        this.setupAutoRefresh();
    }

    /**
     * Bind DOM events
     */
    bindEvents() {
        // Send message on button click
        document.getElementById('sendMessageBtn')?.addEventListener('click', () => this.sendMessage());
        
        // Send message on Enter key (with Shift for new line)
        document.getElementById('messageInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Character count for textarea
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', () => this.updateCharCount());
        }

        // Bot selection from sidebar
        document.querySelectorAll('.bot-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const botId = e.currentTarget.dataset.botId;
                if (botId) this.selectBot(botId);
            });
        });

        // Clear chat button
        document.getElementById('clearChatBtn')?.addEventListener('click', () => this.clearChat());

        // Export chat button
        document.getElementById('exportChatBtn')?.addEventListener('click', () => this.exportChat());

        // Theme toggle
        document.getElementById('themeToggleBtn')?.addEventListener('click', () => this.toggleTheme());
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            // Load bots list
            await this.loadBots();
            
            // Load initial messages if any
            await this.loadMessages();
            
            // Update API status
            this.checkApiStatus();
        } catch (error) {
            this.showToast('Error loading initial data', 'error');
            console.error('Load error:', error);
        }
    }

    /**
     * Load bots from API
     */
    async loadBots() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/bots`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const bots = await response.json();
            this.renderBots(bots);
            
            // Select first bot if none selected
            if (bots.length > 0 && !this.currentBot) {
                this.selectBot(bots[0].id);
            }
        } catch (error) {
            console.error('Failed to load bots:', error);
            this.showToast('Failed to load bots', 'error');
        }
    }

    /**
     * Render bots in sidebar
     */
    renderBots(bots) {
        const botList = document.querySelector('.bot-list');
        if (!botList) return;

        if (bots.length === 0) {
            botList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <p>No bots available</p>
                    <p class="small">Create your first bot to get started</p>
                </div>
            `;
            return;
        }

        botList.innerHTML = bots.map(bot => `
            <div class="bot-item ${this.currentBot?.id === bot.id ? 'active' : ''}" 
                 data-bot-id="${bot.id}">
                <div class="bot-avatar">${bot.name.charAt(0).toUpperCase()}</div>
                <div class="bot-info">
                    <div class="bot-name">${this.escapeHtml(bot.name)}</div>
                    <div class="bot-meta">
                        <span class="status-dot ${bot.active ? '' : 'inactive'}"></span>
                        <span>${bot.provider || 'Custom'}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Rebind click events
        document.querySelectorAll('.bot-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const botId = e.currentTarget.dataset.botId;
                if (botId) this.selectBot(botId);
            });
        });

        // Update bot count
        const botCountElement = document.querySelector('.bot-count');
        if (botCountElement) {
            botCountElement.textContent = `${bots.length} bots`;
        }
    }

    /**
     * Select a bot for chatting
     */
    async selectBot(botId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/bots/${botId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            this.currentBot = await response.json();
            this.updateChatHeader();
            this.loadMessages();
            
            // Update active state in sidebar
            document.querySelectorAll('.bot-item').forEach(item => {
                item.classList.toggle('active', item.dataset.botId === botId);
            });
            
            // Show chat section
            this.showSection('chat');
            
            this.showToast(`Switched to ${this.currentBot.name}`, 'success');
        } catch (error) {
            console.error('Failed to select bot:', error);
            this.showToast('Failed to load bot details', 'error');
        }
    }

    /**
     * Update chat header with bot info
     */
    updateChatHeader() {
        if (!this.currentBot) return;

        const chatHeader = document.querySelector('.chat-header');
        if (!chatHeader) return;

        chatHeader.innerHTML = `
            <div class="chat-bot-info">
                <div class="bot-avatar">${this.currentBot.name.charAt(0).toUpperCase()}</div>
                <div>
                    <h2>${this.escapeHtml(this.currentBot.name)}</h2>
                    <p class="bot-status">
                        <span class="status-dot ${this.currentBot.active ? '' : 'inactive'}"></span>
                        ${this.currentBot.active ? 'Active' : 'Inactive'}
                        ${this.currentBot.provider ? `• ${this.currentBot.provider}` : ''}
                    </p>
                </div>
            </div>
            <div class="chat-actions">
                <button class="btn-secondary" id="clearChatBtn">
                    <i class="fas fa-trash"></i> Clear
                </button>
                <button class="btn-secondary" id="exportChatBtn">
                    <i class="fas fa-download"></i> Export
                </button>
                <button class="btn-primary" id="botSettingsBtn">
                    <i class="fas fa-cog"></i> Settings
                </button>
            </div>
        `;

        // Rebind action buttons
        document.getElementById('clearChatBtn')?.addEventListener('click', () => this.clearChat());
        document.getElementById('exportChatBtn')?.addEventListener('click', () => this.exportChat());
        document.getElementById('botSettingsBtn')?.addEventListener('click', () => this.openBotSettings());
    }

    /**
     * Send a message to the current bot
     */
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input?.value.trim();
        
        if (!message || !this.currentBot || this.isTyping) return;
        
        // Clear input
        if (input) input.value = '';
        this.updateCharCount();
        
        // Add user message to UI
        const userMessage = {
            id: Date.now(),
            content: message,
            sender: 'user',
            timestamp: new Date().toISOString()
        };
        
        this.addMessageToUI(userMessage);
        this.messages.push(userMessage);
        
        // Show typing indicator
        this.showTypingIndicator(true);
        
        try {
            // Send to API
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    botId: this.currentBot.id,
                    message: message,
                    history: this.messages.slice(-10) // Send last 10 messages for context
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Add bot response to UI
            const botMessage = {
                id: Date.now() + 1,
                content: data.response,
                sender: 'assistant',
                timestamp: new Date().toISOString()
            };
            
            this.addMessageToUI(botMessage);
            this.messages.push(botMessage);
            
            // Save conversation
            await this.saveConversation();
            
        } catch (error) {
            console.error('Failed to send message:', error);
            
            // Show error message
            const errorMessage = {
                id: Date.now() + 1,
                content: 'Sorry, I encountered an error. Please try again.',
                sender: '