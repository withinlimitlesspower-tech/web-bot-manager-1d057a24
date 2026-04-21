/* ============================================
   BOT MANAGER - ANALYTICS MODULE
   Version: 2.0.0
   Purpose: Charts and statistics for bot analytics
   ============================================ */

class AnalyticsManager {
    constructor() {
        this.charts = new Map();
        this.statsData = null;
        this.apiBaseUrl = '/api/analytics';
        this.refreshInterval = null;
        this.isInitialized = false;
    }

    /**
     * Initialize analytics module
     */
    async init() {
        if (this.isInitialized) return;
        
        try {
            await this.loadStats();
            this.setupCharts();
            this.setupEventListeners();
            this.startAutoRefresh();
            this.isInitialized = true;
            
            console.log('Analytics module initialized');
        } catch (error) {
            console.error('Failed to initialize analytics:', error);
            this.showError('Failed to load analytics data');
        }
    }

    /**
     * Load statistics data from API
     */
    async loadStats() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/stats`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.statsData = await response.json();
            this.updateStatsDisplay();
            
        } catch (error) {
            console.error('Error loading stats:', error);
            throw error;
        }
    }

    /**
     * Update statistics display cards
     */
    updateStatsDisplay() {
        if (!this.statsData) return;

        const stats = this.statsData;
        
        // Update total bots card
        const totalBotsElement = document.querySelector('.stat-card:nth-child(1) .stat-content h3');
        if (totalBotsElement) {
            totalBotsElement.textContent = stats.totalBots || 0;
        }

        // Update active conversations card
        const activeConvosElement = document.querySelector('.stat-card:nth-child(2) .stat-content h3');
        if (activeConvosElement) {
            activeConvosElement.textContent = stats.activeConversations || 0;
        }

        // Update messages today card
        const messagesTodayElement = document.querySelector('.stat-card:nth-child(3) .stat-content h3');
        if (messagesTodayElement) {
            messagesTodayElement.textContent = stats.messagesToday || 0;
        }

        // Update success rate card
        const successRateElement = document.querySelector('.stat-card:nth-child(4) .stat-content h3');
        if (successRateElement) {
            const rate = stats.successRate || 0;
            successRateElement.textContent = `${rate}%`;
            
            // Color code based on success rate
            const parentCard = successRateElement.closest('.stat-card');
            if (parentCard) {
                parentCard.classList.remove('high-rate', 'medium-rate', 'low-rate');
                if (rate >= 90) parentCard.classList.add('high-rate');
                else if (rate >= 70) parentCard.classList.add('medium-rate');
                else parentCard.classList.add('low-rate');
            }
        }
    }

    /**
     * Setup all charts
     */
    setupCharts() {
        this.setupMessagesChart();
        this.setupBotsChart();
        this.setupPerformanceChart();
    }

    /**
     * Setup messages over time chart
     */
    setupMessagesChart() {
        const canvas = document.getElementById('messagesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if present
        if (this.charts.has('messages')) {
            this.charts.get('messages').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.getLast7Days(),
                datasets: [{
                    label: 'Messages',
                    data: this.generateMessageData(),
                    borderColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--primary-color').trim(),
                    backgroundColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--primary-color').trim() + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--text-primary').trim(),
                            font: {
                                family: getComputedStyle(document.documentElement)
                                    .getPropertyValue('--font-family').split(',')[0]
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: getComputedStyle(document.documentElement)
                            .getPropertyValue('--bg-card').trim(),
                        titleColor: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-primary').trim(),
                        bodyColor: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-secondary').trim(),
                        borderColor: getComputedStyle(document.documentElement)
                            .getPropertyValue('--border-color').trim(),
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--border-color').trim()
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--text-secondary').trim()
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--border-color').trim()
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--text-secondary').trim()
                        }
                    }
                }
            }
        });

        this.charts.set('messages', chart);
    }

    /**
     * Setup bots distribution chart
     */
    setupBotsChart() {
        const canvas = document.getElementById('botsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.has('bots')) {
            this.charts.get('bots').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Inactive', 'Training', 'Error'],
                datasets: [{
                    data: [45, 15, 25, 5],
                    backgroundColor: [
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--success-color').trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--danger-color').trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--warning-color').trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--info-color').trim()
                    ],
                    borderWidth: 1,
                    borderColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--bg-card').trim()
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--text-primary').trim(),
                            font: {
                                family: getComputedStyle(document.documentElement)
                                    .getPropertyValue('--font-family').split(',')[0]
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });

        this.charts.set('bots', chart);
    }

    /**
     * Setup performance metrics chart
     */
    setupPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.has('performance')) {
            this.charts.get('performance').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Response Time', 'Accuracy', 'User Satisfaction', 'Uptime'],
                datasets: [{
                    label: 'Score (%)',
                    data: [85, 92, 88, 99],
                    backgroundColor: [
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--primary-color').trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--success-color').trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--accent-color').trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--info-color').trim()
                    ],
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },