// UI management and event handling

import { AppConfig, Transaction, WalletInfo, OperationStatus, LogEntry } from './types';
import { Database } from './database';

export class UIManager {
    private logs: LogEntry[] = [];
    private database: Database;

    constructor(database: Database) {
        this.database = database;
    }

    /**
     * Initialize UI event listeners
     */
    init(): void {
        // Logs
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        const exportLogsBtn = document.getElementById('exportLogsBtn');
        
        clearLogsBtn?.addEventListener('click', () => this.clearLogs());
        exportLogsBtn?.addEventListener('click', () => this.exportLogs());

        // Transactions
        const exportTxBtn = document.getElementById('exportTxBtn');
        const searchTx = document.getElementById('searchTx') as HTMLInputElement;

        exportTxBtn?.addEventListener('click', () => this.exportTransactions());
        searchTx?.addEventListener('input', (e) => this.searchTransactions((e.target as HTMLInputElement).value));

        // Wallets
        const exportWalletsBtn = document.getElementById('exportWalletsBtn');
        exportWalletsBtn?.addEventListener('click', () => this.exportWallets());
    }

    /**
     * Show password section
     */
    showPasswordSection(): void {
        const passwordSection = document.getElementById('passwordSection');
        const appSection = document.getElementById('appSection');
        
        if (passwordSection) passwordSection.classList.remove('hidden');
        if (appSection) appSection.classList.add('hidden');
    }

    /**
     * Show main application
     */
    showApp(): void {
        const passwordSection = document.getElementById('passwordSection');
        const appSection = document.getElementById('appSection');
        
        if (passwordSection) passwordSection.classList.add('hidden');
        if (appSection) appSection.classList.remove('hidden');
    }

    /**
     * Get config from form
     */
    getConfigFromForm(): AppConfig {
        return {
            tokenAddress: (document.getElementById('tokenAddress') as HTMLInputElement).value.trim(),
            numWallets: parseInt((document.getElementById('numWallets') as HTMLInputElement).value),
            masterPrivateKey: (document.getElementById('masterPrivateKey') as HTMLInputElement).value.trim(),
            targetAddress: (document.getElementById('targetAddress') as HTMLInputElement).value.trim(),
            gasAmount: (document.getElementById('gasAmount') as HTMLInputElement).value.trim(),
            minPurchaseAmount: (document.getElementById('minPurchaseAmount') as HTMLInputElement).value.trim(),
            maxPurchaseAmount: (document.getElementById('maxPurchaseAmount') as HTMLInputElement).value.trim(),
            minKeptTokens: (document.getElementById('minKeptTokens') as HTMLInputElement).value.trim(),
            chain: (document.getElementById('chain') as HTMLSelectElement).value,
            dex: (document.getElementById('dex') as HTMLSelectElement).value,
            rpcUrl: (document.getElementById('rpcUrl') as HTMLInputElement).value.trim()
        };
    }

    /**
     * Load config into form
     */
    loadConfigIntoForm(config: AppConfig): void {
        (document.getElementById('tokenAddress') as HTMLInputElement).value = config.tokenAddress;
        (document.getElementById('numWallets') as HTMLInputElement).value = config.numWallets.toString();
        (document.getElementById('masterPrivateKey') as HTMLInputElement).value = config.masterPrivateKey;
        (document.getElementById('targetAddress') as HTMLInputElement).value = config.targetAddress;
        (document.getElementById('gasAmount') as HTMLInputElement).value = config.gasAmount;
        (document.getElementById('minPurchaseAmount') as HTMLInputElement).value = config.minPurchaseAmount;
        (document.getElementById('maxPurchaseAmount') as HTMLInputElement).value = config.maxPurchaseAmount;
        (document.getElementById('minKeptTokens') as HTMLInputElement).value = config.minKeptTokens;
        (document.getElementById('chain') as HTMLSelectElement).value = config.chain || 'base';
        (document.getElementById('dex') as HTMLSelectElement).value = config.dex || 'uniswap-v3';
        (document.getElementById('rpcUrl') as HTMLInputElement).value = config.rpcUrl;
    }

    /**
     * Update operation status display
     */
    updateStatus(status: OperationStatus): void {
        const operationStatus = document.getElementById('operationStatus');
        const walletsCreated = document.getElementById('walletsCreated');
        const ethTransferred = document.getElementById('ethTransferred');
        const swapsCompleted = document.getElementById('swapsCompleted');
        const tokensTransferred = document.getElementById('tokensTransferred');
        const progressBar = document.getElementById('progressBar');

        if (operationStatus) operationStatus.textContent = status.currentStep;
        if (walletsCreated) walletsCreated.textContent = status.walletsCreated.toString();
        if (ethTransferred) ethTransferred.textContent = status.ethTransferred.toString();
        if (swapsCompleted) swapsCompleted.textContent = status.swapsCompleted.toString();
        if (tokensTransferred) tokensTransferred.textContent = status.tokensTransferred.toString();
        
        if (progressBar) {
            progressBar.style.width = `${status.progress}%`;
            progressBar.textContent = `${Math.round(status.progress)}%`;
        }
    }

    /**
     * Add log entry
     */
    addLog(level: 'info' | 'success' | 'warning' | 'error', message: string, data?: any): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            data
        };

        this.logs.push(entry);

        const logsContainer = document.getElementById('logsContainer');
        if (!logsContainer) return;

        const logElement = document.createElement('div');
        logElement.className = `log-entry ${level}`;
        
        const timestamp = entry.timestamp.toLocaleTimeString();
        logElement.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span>${message}</span>
        `;

        logsContainer.appendChild(logElement);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    /**
     * Clear logs
     */
    clearLogs(): void {
        this.logs = [];
        const logsContainer = document.getElementById('logsContainer');
        if (logsContainer) {
            logsContainer.innerHTML = '';
        }
    }

    /**
     * Export logs as text file
     */
    exportLogs(): void {
        const content = this.logs.map(log => {
            const timestamp = log.timestamp.toISOString();
            return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
        }).join('\n');

        this.downloadFile('logs.txt', content);
        this.addLog('success', 'Logs exported successfully');
    }

    /**
     * Update transactions table
     */
    async updateTransactionsTable(): Promise<void> {
        const transactions = await this.database.getAllTransactions();
        this.renderTransactions(transactions);
    }

    /**
     * Render transactions in table
     */
    private renderTransactions(transactions: Transaction[]): void {
        const tbody = document.getElementById('transactionTableBody');
        if (!tbody) return;

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No transactions yet</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(tx => {
            const statusClass = tx.status === 'success' ? 'success' : tx.status === 'failed' ? 'failed' : 'pending';
            const typeLabel = this.formatTxType(tx.type);
            
            return `
                <tr>
                    <td>${tx.timestamp.toLocaleString()}</td>
                    <td>${typeLabel}</td>
                    <td title="${tx.fromAddress}">${this.truncateAddress(tx.fromAddress)}</td>
                    <td title="${tx.toAddress}">${this.truncateAddress(tx.toAddress)}</td>
                    <td>${parseFloat(tx.amount).toFixed(6)} ${tx.token || 'ETH'}</td>
                    <td><span class="status-badge ${statusClass}">${tx.status}</span></td>
                    <td>${tx.txHash ? this.renderTxHash(tx.txHash) : '-'}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Search transactions
     */
    private async searchTransactions(query: string): Promise<void> {
        const transactions = await this.database.getAllTransactions();
        
        if (!query) {
            this.renderTransactions(transactions);
            return;
        }

        const filtered = transactions.filter(tx => {
            return tx.fromAddress.toLowerCase().includes(query.toLowerCase()) ||
                   tx.toAddress.toLowerCase().includes(query.toLowerCase()) ||
                   tx.txHash?.toLowerCase().includes(query.toLowerCase()) ||
                   tx.type.includes(query.toLowerCase());
        });

        this.renderTransactions(filtered);
    }

    /**
     * Export transactions as CSV
     */
    async exportTransactions(): Promise<void> {
        const transactions = await this.database.getAllTransactions();
        
        const headers = ['Timestamp', 'Type', 'From', 'To', 'Amount', 'Token', 'Status', 'TxHash'];
        const rows = transactions.map(tx => [
            tx.timestamp.toISOString(),
            tx.type,
            tx.fromAddress,
            tx.toAddress,
            tx.amount,
            tx.token || 'ETH',
            tx.status,
            tx.txHash || ''
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        this.downloadFile('transactions.csv', csv);
        this.addLog('success', 'Transactions exported successfully');
    }

    /**
     * Update wallets table
     */
    async updateWalletsTable(): Promise<void> {
        const wallets = await this.database.getAllWallets();
        this.renderWallets(wallets);
    }

    /**
     * Render wallets in table
     */
    private renderWallets(wallets: WalletInfo[]): void {
        const tbody = document.getElementById('walletsTableBody');
        if (!tbody) return;

        if (wallets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No wallets created yet</td></tr>';
            return;
        }

        tbody.innerHTML = wallets.map((wallet, index) => {
            const statusClass = wallet.status === 'completed' ? 'success' : 
                              wallet.status === 'created' ? 'pending' : 'warning';
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td title="${wallet.address}">${wallet.address}</td>
                    <td>${wallet.ethBalance || '-'}</td>
                    <td>${wallet.tokenBalance || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${wallet.status}</span></td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Export wallets
     */
    async exportWallets(): Promise<void> {
        const wallets = await this.database.getAllWallets();
        
        const headers = ['Address', 'Created At', 'Status', 'ETH Balance', 'Token Balance', 'Encrypted Private Key'];
        const rows = wallets.map(w => [
            w.address,
            w.createdAt.toISOString(),
            w.status,
            w.ethBalance || '',
            w.tokenBalance || '',
            w.encryptedPrivateKey
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        this.downloadFile('wallets.csv', csv);
        this.addLog('warning', '⚠️ Wallets exported with encrypted private keys');
    }

    /**
     * Set operation buttons state
     */
    setOperationRunning(isRunning: boolean): void {
        const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
        const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
        const loadConfigBtn = document.getElementById('loadConfigBtn') as HTMLButtonElement;

        if (startBtn) startBtn.disabled = isRunning;
        if (stopBtn) stopBtn.disabled = !isRunning;
        if (loadConfigBtn) loadConfigBtn.disabled = isRunning;

        // Disable form inputs
        const inputs = document.querySelectorAll('#configForm input');
        inputs.forEach(input => {
            (input as HTMLInputElement).disabled = isRunning;
        });
    }

    /**
     * Show error message
     */
    showError(message: string): void {
        alert(`Error: ${message}`);
        this.addLog('error', message);
    }

    /**
     * Show success message
     */
    showSuccess(message: string): void {
        this.addLog('success', message);
    }

    /**
     * Format transaction type
     */
    private formatTxType(type: string): string {
        const labels: Record<string, string> = {
            'fund_transfer': '💰 Fund Transfer',
            'token_swap': '🔄 Token Swap',
            'token_transfer': '📤 Token Transfer',
            'eth_transfer': '💎 ETH Transfer'
        };
        return labels[type] || type;
    }

    /**
     * Truncate address for display
     */
    private truncateAddress(address: string): string {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    /**
     * Render transaction hash as link
     */
    private renderTxHash(hash: string): string {
        const truncated = this.truncateAddress(hash);
        return `<a href="https://basescan.org/tx/${hash}" target="_blank" class="tx-hash">${truncated}</a>`;
    }

    /**
     * Download file
     */
    private downloadFile(filename: string, content: string): void {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Reset status display
     */
    resetStatus(): void {
        const status: OperationStatus = {
            isRunning: false,
            walletsCreated: 0,
            ethTransferred: 0,
            swapsCompleted: 0,
            tokensTransferred: 0,
            currentStep: 'Idle',
            progress: 0
        };
        this.updateStatus(status);
    }
}
