// IndexedDB wrapper for local storage

import { WalletInfo, Transaction, AppConfig } from './types';

export class Database {
    private static readonly DB_NAME = 'MassTokenBuyDB';
    private static readonly DB_VERSION = 1;
    private db: IDBDatabase | null = null;

    /**
     * Initialize the database
     */
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(Database.DB_NAME, Database.DB_VERSION);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create wallets store
                if (!db.objectStoreNames.contains('wallets')) {
                    const walletsStore = db.createObjectStore('wallets', { keyPath: 'id', autoIncrement: true });
                    walletsStore.createIndex('address', 'address', { unique: true });
                    walletsStore.createIndex('status', 'status', { unique: false });
                }

                // Create transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    txStore.createIndex('timestamp', 'timestamp', { unique: false });
                    txStore.createIndex('type', 'type', { unique: false });
                    txStore.createIndex('status', 'status', { unique: false });
                    txStore.createIndex('txHash', 'txHash', { unique: false });
                }

                // Create config store
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'id' });
                }

                // Create metadata store
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Save wallet information
     */
    async saveWallet(wallet: WalletInfo): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['wallets'], 'readwrite');
            const store = transaction.objectStore('wallets');
            // Remove id field to let autoIncrement work properly
            const { id, ...walletData } = wallet;
            const request = store.add(walletData);

            request.onsuccess = () => {
                resolve(request.result as number);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', request.error, event);
                reject(new Error(`Failed to save wallet: ${request.error?.message || 'Unknown error'}`));
            };
        });
    }

    /**
     * Get a single wallet by ID
     */
    async getWallet(id: number): Promise<WalletInfo | undefined> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['wallets'], 'readonly');
            const store = transaction.objectStore('wallets');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get wallet'));
            };
        });
    }

    /**
     * Get all wallets
     */
    async getAllWallets(): Promise<WalletInfo[]> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['wallets'], 'readonly');
            const store = transaction.objectStore('wallets');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get wallets'));
            };
        });
    }

    /**
     * Update wallet status
     */
    async updateWallet(id: number, updates: Partial<WalletInfo>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['wallets'], 'readwrite');
            const store = transaction.objectStore('wallets');
            const request = store.get(id);

            request.onsuccess = () => {
                const wallet = request.result;
                if (!wallet) {
                    reject(new Error('Wallet not found'));
                    return;
                }

                const updatedWallet = { ...wallet, ...updates };
                const updateRequest = store.put(updatedWallet);

                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(new Error('Failed to update wallet'));
            };

            request.onerror = () => {
                reject(new Error('Failed to get wallet'));
            };
        });
    }

    /**
     * Save transaction
     */
    async saveTransaction(transaction: Transaction): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            const request = store.add(transaction);

            request.onsuccess = () => {
                resolve(request.result as number);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', request.error, event);
                reject(new Error(`Failed to save transaction: ${request.error?.message || 'Unknown error'}`));
            };
        });
    }

    /**
     * Get all transactions
     */
    async getAllTransactions(): Promise<Transaction[]> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get transactions'));
            };
        });
    }

    /**
     * Update transaction
     */
    async updateTransaction(id: number, updates: Partial<Transaction>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const request = store.get(id);

            request.onsuccess = () => {
                const tx = request.result;
                if (!tx) {
                    reject(new Error('Transaction not found'));
                    return;
                }

                const updatedTx = { ...tx, ...updates };
                const updateRequest = store.put(updatedTx);

                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(new Error('Failed to update transaction'));
            };

            request.onerror = () => {
                reject(new Error('Failed to get transaction'));
            };
        });
    }

    /**
     * Save app configuration
     */
    async saveConfig(config: AppConfig): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');
            const request = store.put({ id: 'main', ...config });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to save config'));
        });
    }

    /**
     * Get app configuration
     */
    async getConfig(): Promise<AppConfig | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.get('main');

            request.onsuccess = () => {
                const result = request.result;
                if (!result) {
                    resolve(null);
                    return;
                }
                // Remove the 'id' property
                const { id, ...config } = result;
                resolve(config as AppConfig);
            };

            request.onerror = () => {
                reject(new Error('Failed to get config'));
            };
        });
    }

    /**
     * Save metadata
     */
    async saveMetadata(key: string, value: any): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            const request = store.put({ key, value });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to save metadata'));
        });
    }

    /**
     * Get metadata
     */
    async getMetadata(key: string): Promise<any> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };

            request.onerror = () => {
                reject(new Error('Failed to get metadata'));
            };
        });
    }

    /**
     * Clear all data
     */
    async clearAll(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const stores = ['wallets', 'transactions', 'config', 'metadata'];
        const promises = stores.map(storeName => {
            return new Promise<void>((resolve, reject) => {
                const transaction = this.db!.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
            });
        });

        await Promise.all(promises);
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
