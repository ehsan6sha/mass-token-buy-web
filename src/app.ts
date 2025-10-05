// Main application entry point

import '../styles.css';
import { Database } from './database';
import { WalletService } from './wallet';
import { DexService } from './dex';
import { TransactionManager } from './transactions';
import { UIManager } from './ui';
import { CryptoService } from './crypto';
import { AppConfig } from './types';

class App {
    private database: Database;
    private walletService: WalletService | null = null;
    private dexService: DexService;
    private transactionManager: TransactionManager | null = null;
    private uiManager: UIManager;
    private masterPassword: string = '';
    private isUnlocked: boolean = false;

    constructor() {
        this.database = new Database();
        // Initialize DEX service (defaults to Uniswap V3 on Base)
        this.dexService = new DexService('base', 'uniswap-v3');
        this.uiManager = new UIManager(this.database);
    }

    /**
     * Initialize the application
     */
    async init(): Promise<void> {
        try {
            console.log('🚀 Initializing Mass Token Buy Bot...');

            // Initialize database
            await this.database.init();
            console.log('✓ Database initialized');

            // Initialize UI
            this.uiManager.init();
            this.uiManager.showPasswordSection();
            console.log('✓ UI initialized');

            // Setup event listeners
            this.setupEventListeners();
            console.log('✓ Event listeners setup');

            console.log('🎉 Application ready!');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            alert(`Failed to initialize application: ${error}`);
        }
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Terms checkbox - enable/disable unlock button
        const termsCheckbox = document.getElementById('termsCheckbox') as HTMLInputElement;
        const unlockBtn = document.getElementById('unlockBtn') as HTMLButtonElement;
        
        termsCheckbox?.addEventListener('change', () => {
            if (unlockBtn) {
                unlockBtn.disabled = !termsCheckbox.checked;
            }
        });

        // Unlock button
        unlockBtn?.addEventListener('click', () => this.handleUnlock());

        // Password input - allow Enter key
        const masterPasswordInput = document.getElementById('masterPassword') as HTMLInputElement;
        masterPasswordInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // Only unlock if terms are accepted
                if (termsCheckbox?.checked) {
                    this.handleUnlock();
                }
            }
        });

        // Config form
        const configForm = document.getElementById('configForm');
        configForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleStartOperation();
        });

        // Stop button
        const stopBtn = document.getElementById('stopBtn');
        stopBtn?.addEventListener('click', () => this.handleStopOperation());

        // Load config button
        const loadConfigBtn = document.getElementById('loadConfigBtn');
        loadConfigBtn?.addEventListener('click', () => this.handleLoadConfig());

        // Clear database button
        const clearDbBtn = document.getElementById('clearDbBtn');
        clearDbBtn?.addEventListener('click', () => this.handleClearDatabase());
    }

    /**
     * Handle unlock
     */
    private async handleUnlock(): Promise<void> {
        const passwordInput = document.getElementById('masterPassword') as HTMLInputElement;
        const password = passwordInput.value;

        if (!password || password.length < 8) {
            alert('Please enter a password with at least 8 characters');
            return;
        }

        try {
            // Check if password was previously set
            const savedPasswordHash = await this.database.getMetadata('passwordHash');

            if (savedPasswordHash) {
                // Verify password
                const passwordHash = await CryptoService.hashPassword(password);
                if (passwordHash !== savedPasswordHash) {
                    alert('Incorrect password!');
                    return;
                }
            } else {
                // First time - save password hash
                const passwordHash = await CryptoService.hashPassword(password);
                await this.database.saveMetadata('passwordHash', passwordHash);
            }

            this.masterPassword = password;
            this.isUnlocked = true;

            // Initialize services with default RPC
            const defaultRpcUrl = 'https://mainnet.base.org';
            this.walletService = new WalletService(defaultRpcUrl);

            this.uiManager.showApp();
            this.uiManager.addLog('success', '🔓 Application unlocked successfully');

            // Load saved config if exists
            const savedConfig = await this.database.getConfig();
            if (savedConfig) {
                this.uiManager.loadConfigIntoForm(savedConfig);
                this.uiManager.addLog('info', 'Previous configuration loaded');
            }

            // Load previous transactions and wallets
            await this.uiManager.updateTransactionsTable();
            await this.uiManager.updateWalletsTable();

        } catch (error) {
            console.error('Unlock error:', error);
            alert(`Failed to unlock: ${error}`);
        }
    }

    /**
     * Handle start operation
     */
    private async handleStartOperation(): Promise<void> {
        if (!this.isUnlocked || !this.walletService) {
            this.uiManager.showError('Application is not unlocked');
            return;
        }

        try {
            // Get configuration from form
            const config = this.uiManager.getConfigFromForm();

            // Validate config
            this.validateConfig(config);

            // Save configuration
            await this.database.saveConfig(config);
            this.uiManager.addLog('info', 'Configuration saved');

            // Update RPC URL if changed (use chain default if not provided)
            const rpcUrl = config.rpcUrl || undefined;
            if (rpcUrl) {
                this.walletService.updateProvider(rpcUrl);
            }

            // Initialize transaction manager
            this.transactionManager = new TransactionManager(
                this.walletService,
                this.dexService,
                this.database
            );

            // Setup callbacks
            this.transactionManager.onStatusUpdate = (status) => {
                this.uiManager.updateStatus(status);
            };

            this.transactionManager.onLog = (level, message, data) => {
                this.uiManager.addLog(level, message, data);
                
                // Update tables on specific events
                if (level === 'success') {
                    this.uiManager.updateTransactionsTable();
                    this.uiManager.updateWalletsTable();
                }
            };

            // Set UI to running state
            this.uiManager.setOperationRunning(true);
            this.uiManager.resetStatus();

            // Execute operation
            await this.transactionManager.executeOperation(config, this.masterPassword);

            // Update final state
            await this.uiManager.updateTransactionsTable();
            await this.uiManager.updateWalletsTable();

        } catch (error: any) {
            console.error('Operation error:', error);
            this.uiManager.showError(error.message || 'Operation failed');
        } finally {
            this.uiManager.setOperationRunning(false);
        }
    }

    /**
     * Handle stop operation
     */
    private handleStopOperation(): void {
        if (this.transactionManager && this.transactionManager.isOperationRunning()) {
            this.transactionManager.stopOperation();
            this.uiManager.addLog('warning', 'Stopping operation...');
        }
    }

    /**
     * Handle load config
     */
    private async handleLoadConfig(): Promise<void> {
        try {
            const config = await this.database.getConfig();
            if (config) {
                this.uiManager.loadConfigIntoForm(config);
                this.uiManager.showSuccess('Configuration loaded successfully');
            } else {
                this.uiManager.showError('No saved configuration found');
            }
        } catch (error) {
            console.error('Load config error:', error);
            this.uiManager.showError('Failed to load configuration');
        }
    }

    /**
     * Handle clear database
     */
    private async handleClearDatabase(): Promise<void> {
        const confirmed = confirm(
            '⚠️ WARNING: This will delete ALL wallets, transactions, and configuration data from the local database.\n\n' +
            'This action cannot be undone!\n\n' +
            'Are you sure you want to continue?'
        );

        if (!confirmed) {
            return;
        }

        try {
            await this.database.clearAll();
            this.uiManager.showSuccess('✓ Database cleared successfully!');
            this.uiManager.addLog('success', 'All data cleared from database');
            
            // Refresh the UI
            await this.uiManager.updateTransactionsTable();
            await this.uiManager.updateWalletsTable();
            this.uiManager.resetStatus();
            
            // Clear form
            (document.getElementById('configForm') as HTMLFormElement)?.reset();
        } catch (error) {
            console.error('Clear database error:', error);
            this.uiManager.showError('Failed to clear database');
        }
    }

    /**
     * Validate configuration
     */
    private validateConfig(config: AppConfig): void {
        if (!config.tokenAddress || !config.tokenAddress.startsWith('0x')) {
            throw new Error('Invalid token address');
        }

        if (!config.targetAddress || !config.targetAddress.startsWith('0x')) {
            throw new Error('Invalid target address');
        }

        if (!config.masterPrivateKey || !config.masterPrivateKey.startsWith('0x')) {
            throw new Error('Invalid master private key');
        }

        if (isNaN(config.numWallets) || config.numWallets < 1 || config.numWallets > 1000) {
            throw new Error('Number of wallets must be between 1 and 1000');
        }

        if (isNaN(parseFloat(config.gasAmount)) || parseFloat(config.gasAmount) <= 0) {
            throw new Error('Gas amount must be a positive number');
        }

        if (isNaN(parseFloat(config.minPurchaseAmount)) || parseFloat(config.minPurchaseAmount) <= 0) {
            throw new Error('Minimum purchase amount must be a positive number');
        }

        if (isNaN(parseFloat(config.maxPurchaseAmount)) || parseFloat(config.maxPurchaseAmount) <= 0) {
            throw new Error('Maximum purchase amount must be a positive number');
        }

        if (parseFloat(config.minPurchaseAmount) > parseFloat(config.maxPurchaseAmount)) {
            throw new Error('Minimum purchase amount cannot be greater than maximum purchase amount');
        }

        if (isNaN(parseFloat(config.minKeptTokens)) || parseFloat(config.minKeptTokens) < 0) {
            throw new Error('Minimum kept tokens cannot be negative');
        }

        if (!config.rpcUrl || !config.rpcUrl.startsWith('http')) {
            throw new Error('Invalid RPC URL');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});

// Make app available globally for debugging
(window as any).app = App;
