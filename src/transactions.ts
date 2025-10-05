// Transaction management and orchestration

import { ethers } from 'ethers';
import { WalletService } from './wallet';
import { DexService } from './dex';
import { Database } from './database';
import { AppConfig, WalletInfo, Transaction, OperationStatus } from './types';

export class TransactionManager {
    private walletService: WalletService;
    private dexService: DexService;
    private database: Database;
    private isRunning: boolean = false;
    private shouldStop: boolean = false;
    
    // Callbacks for UI updates
    public onStatusUpdate?: (status: OperationStatus) => void;
    public onLog?: (level: 'info' | 'success' | 'warning' | 'error', message: string, data?: any) => void;

    constructor(walletService: WalletService, dexService: DexService, database: Database) {
        this.walletService = walletService;
        this.dexService = dexService;
        this.database = database;
    }

    /**
     * Main operation: Create wallets, fund them, swap, and transfer
     */
    async executeOperation(config: AppConfig, password: string): Promise<void> {
        if (this.isRunning) {
            throw new Error('Operation is already running');
        }

        this.isRunning = true;
        this.shouldStop = false;

        const status: OperationStatus = {
            isRunning: true,
            walletsCreated: 0,
            ethTransferred: 0,
            swapsCompleted: 0,
            tokensTransferred: 0,
            currentStep: 'Starting...',
            progress: 0
        };

        try {
            this.log('info', '🚀 Starting mass token buy operation');
            
            // Step 1: Validate configuration
            this.log('info', 'Validating configuration...');
            this.validateConfig(config);
            status.currentStep = 'Configuration validated';
            this.updateStatus(status);

            // Update DEX configuration
            this.dexService.updateConfig(config.chain, config.dex, config.rpcUrl || undefined);
            this.log('info', `Using ${config.dex} on ${config.chain}`);

            // Step 2: Load master wallet
            this.log('info', 'Loading master wallet...');
            const masterWallet = this.walletService.getWalletFromPrivateKey(config.masterPrivateKey);
            const masterBalance = await this.walletService.getBalance(masterWallet.address);
            this.log('success', `Master wallet loaded: ${masterWallet.address}`);
            this.log('info', `Master wallet balance: ${masterBalance} ETH`);

            // Calculate total ETH needed
            const ethPerWallet = parseFloat(config.gasAmount) + parseFloat(config.purchaseAmount);
            const totalETHNeeded = ethPerWallet * config.numWallets;
            
            this.log('info', `Total ETH needed: ${totalETHNeeded.toFixed(6)} ETH`);
            this.log('info', `ETH per wallet: ${ethPerWallet.toFixed(6)} ETH`);

            if (parseFloat(masterBalance) < totalETHNeeded) {
                throw new Error(`Insufficient balance. Need ${totalETHNeeded} ETH, have ${masterBalance} ETH`);
            }

            // Step 3: Create wallets
            this.log('info', `Creating ${config.numWallets} wallets...`);
            status.currentStep = 'Creating wallets';
            this.updateStatus(status);

            const wallets: { wallet: ethers.Wallet; info: WalletInfo; dbId: number }[] = [];

            for (let i = 0; i < config.numWallets; i++) {
                if (this.shouldStop) {
                    this.log('warning', 'Operation stopped by user');
                    break;
                }

                const { wallet, info } = await this.walletService.createWallet(password);
                const dbId = await this.database.saveWallet(info);
                wallets.push({ wallet, info, dbId });

                status.walletsCreated++;
                status.progress = (i + 1) / (config.numWallets * 4) * 100; // 4 main steps
                this.updateStatus(status);

                this.log('info', `Created wallet ${i + 1}/${config.numWallets}: ${wallet.address}`);
                
                // Small delay to prevent overwhelming the system
                await this.delay(100);
            }

            if (this.shouldStop) {
                this.isRunning = false;
                return;
            }

            // Step 4: Fund wallets with ETH
            this.log('info', 'Funding wallets with ETH...');
            status.currentStep = 'Funding wallets';
            this.updateStatus(status);

            for (let i = 0; i < wallets.length; i++) {
                if (this.shouldStop) break;

                const { wallet, dbId } = wallets[i];
                const amountToSend = ethPerWallet.toFixed(18);

                try {
                    this.log('info', `Funding wallet ${i + 1}/${wallets.length}: ${wallet.address}`);
                    
                    // Create transaction record
                    const txRecord: Transaction = {
                        timestamp: new Date(),
                        type: 'fund_transfer',
                        fromAddress: masterWallet.address,
                        toAddress: wallet.address,
                        amount: amountToSend,
                        token: 'ETH',
                        status: 'pending'
                    };
                    const txId = await this.database.saveTransaction(txRecord);

                    // Execute transfer
                    const receipt = await this.walletService.transferETH(
                        masterWallet,
                        wallet.address,
                        amountToSend
                    );

                    // Update transaction record
                    await this.database.updateTransaction(txId, {
                        status: 'success',
                        txHash: receipt.hash,
                        gasUsed: receipt.gasUsed.toString()
                    });

                    // Update wallet status
                    await this.database.updateWallet(dbId, { status: 'funded' });

                    status.ethTransferred++;
                    status.progress = (config.numWallets + i + 1) / (config.numWallets * 4) * 100;
                    this.updateStatus(status);

                    this.log('success', `✓ Funded wallet ${i + 1}: ${receipt.hash}`);
                } catch (error: any) {
                    this.log('error', `Failed to fund wallet ${i + 1}: ${error.message}`, error);
                    await this.database.updateWallet(dbId, { status: 'created' });
                }

                await this.delay(500); // Delay between transactions
            }

            if (this.shouldStop) {
                this.isRunning = false;
                return;
            }

            // Step 5: Swap ETH for tokens
            this.log('info', 'Swapping ETH for tokens...');
            status.currentStep = 'Swapping tokens';
            this.updateStatus(status);

            for (let i = 0; i < wallets.length; i++) {
                if (this.shouldStop) break;

                const { wallet, dbId } = wallets[i];

                try {
                    this.log('info', `Swapping ETH for tokens in wallet ${i + 1}/${wallets.length}`);

                    // Create transaction record
                    const txRecord: Transaction = {
                        timestamp: new Date(),
                        type: 'token_swap',
                        fromAddress: wallet.address,
                        toAddress: wallet.address,
                        amount: config.purchaseAmount,
                        token: config.tokenAddress,
                        status: 'pending'
                    };
                    const txId = await this.database.saveTransaction(txRecord);

                    // Execute swap using DEX with automatic gas management
                    const swapResult = await this.dexService.swapETHToToken(
                        wallet,
                        config.tokenAddress,
                        config.purchaseAmount,
                        0.5 // 0.5% slippage
                    );

                    // Update transaction record
                    await this.database.updateTransaction(txId, {
                        status: 'success',
                        txHash: swapResult.txHash,
                        gasUsed: swapResult.receipt.gasUsed.toString()
                    });

                    // Update wallet status
                    await this.database.updateWallet(dbId, { status: 'swapped' });

                    status.swapsCompleted++;
                    status.progress = (config.numWallets * 2 + i + 1) / (config.numWallets * 4) * 100;
                    this.updateStatus(status);

                    this.log('success', `✓ Swapped in wallet ${i + 1}: ${swapResult.txHash}`);
                } catch (error: any) {
                    this.log('error', `Failed to swap in wallet ${i + 1}: ${error.message}`, error);
                }

                await this.delay(1000); // Longer delay for swaps
            }

            if (this.shouldStop) {
                this.isRunning = false;
                return;
            }

            // Step 6: Transfer tokens and remaining ETH to target address
            this.log('info', 'Transferring tokens to target address...');
            status.currentStep = 'Transferring to target';
            this.updateStatus(status);

            for (let i = 0; i < wallets.length; i++) {
                if (this.shouldStop) break;

                const { wallet, dbId } = wallets[i];

                try {
                    this.log('info', `Transferring from wallet ${i + 1}/${wallets.length}`);

                    // Get token balance
                    const tokenBalance = await this.walletService.getTokenBalance(
                        config.tokenAddress,
                        wallet.address
                    );

                    const minKeptTokens = parseFloat(config.minKeptTokens);
                    const tokensToTransfer = parseFloat(tokenBalance) - minKeptTokens;

                    if (tokensToTransfer > 0) {
                        // Transfer tokens
                        const txRecord: Transaction = {
                            timestamp: new Date(),
                            type: 'token_transfer',
                            fromAddress: wallet.address,
                            toAddress: config.targetAddress,
                            amount: tokensToTransfer.toString(),
                            token: config.tokenAddress,
                            status: 'pending'
                        };
                        const txId = await this.database.saveTransaction(txRecord);

                        const receipt = await this.walletService.transferToken(
                            wallet,
                            config.tokenAddress,
                            config.targetAddress,
                            tokensToTransfer.toString()
                        );

                        await this.database.updateTransaction(txId, {
                            status: 'success',
                            txHash: receipt.hash,
                            gasUsed: receipt.gasUsed.toString()
                        });

                        this.log('success', `✓ Transferred ${tokensToTransfer} tokens: ${receipt.hash}`);
                    }

                    // Transfer remaining ETH (keep some for future gas if needed)
                    const ethBalance = await this.walletService.getBalance(wallet.address);
                    const ethToKeep = parseFloat(config.gasAmount) * 0.1; // Keep 10% of gas amount
                    const ethToTransfer = parseFloat(ethBalance) - ethToKeep;

                    if (ethToTransfer > 0.00001) { // Only transfer if significant amount
                        const txRecord: Transaction = {
                            timestamp: new Date(),
                            type: 'eth_transfer',
                            fromAddress: wallet.address,
                            toAddress: config.targetAddress,
                            amount: ethToTransfer.toString(),
                            token: 'ETH',
                            status: 'pending'
                        };
                        const txId = await this.database.saveTransaction(txRecord);

                        const receipt = await this.walletService.transferETH(
                            wallet,
                            config.targetAddress,
                            ethToTransfer.toFixed(18)
                        );

                        await this.database.updateTransaction(txId, {
                            status: 'success',
                            txHash: receipt.hash,
                            gasUsed: receipt.gasUsed.toString()
                        });

                        this.log('success', `✓ Transferred ${ethToTransfer.toFixed(6)} ETH: ${receipt.hash}`);
                    }

                    // Update wallet status
                    await this.database.updateWallet(dbId, { status: 'completed' });

                    status.tokensTransferred++;
                    status.progress = (config.numWallets * 3 + i + 1) / (config.numWallets * 4) * 100;
                    this.updateStatus(status);

                } catch (error: any) {
                    this.log('error', `Failed to transfer from wallet ${i + 1}: ${error.message}`, error);
                }

                await this.delay(500);
            }

            status.currentStep = 'Completed';
            status.progress = 100;
            status.isRunning = false;
            this.updateStatus(status);

            this.log('success', '🎉 Mass token buy operation completed successfully!');
        } catch (error: any) {
            this.log('error', `Operation failed: ${error.message}`, error);
            status.currentStep = 'Failed - Attempting cleanup';
            this.updateStatus(status);
            
            // Attempt to consolidate any funds from created wallets even if operation failed
            try {
                await this.cleanupAndConsolidateFunds(config, password);
            } catch (cleanupError: any) {
                this.log('error', `Cleanup failed: ${cleanupError.message}`);
            }
            
            status.currentStep = 'Failed';
            status.isRunning = false;
            this.updateStatus(status);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Cleanup function: Consolidate funds from all created wallets (runs on success or failure)
     */
    private async cleanupAndConsolidateFunds(config: AppConfig, password: string): Promise<void> {
        this.log('info', 'Starting cleanup and fund consolidation...');
        
        // Get all wallets from database
        const allWallets = await this.database.getAllWallets();
        
        if (allWallets.length === 0) {
            this.log('info', 'No wallets to clean up');
            return;
        }

        this.log('info', `Found ${allWallets.length} wallets to check for funds`);

        for (let i = 0; i < allWallets.length; i++) {
            try {
                const walletInfo = allWallets[i];
                
                // Skip if already completed
                if (walletInfo.status === 'completed') {
                    continue;
                }

                // Load wallet
                const wallet = await this.walletService.loadWallet(
                    walletInfo.encryptedPrivateKey,
                    password
                );

                // Check ETH balance
                const ethBalance = await this.walletService.getBalance(wallet.address);
                const ethBalanceNum = parseFloat(ethBalance);

                // Check token balance
                let tokenBalance = '0';
                try {
                    tokenBalance = await this.walletService.getTokenBalance(
                        config.tokenAddress,
                        wallet.address
                    );
                } catch (error) {
                    // Token balance check might fail if no tokens, that's ok
                }
                const tokenBalanceNum = parseFloat(tokenBalance);

                this.log('info', `Wallet ${i + 1}: ${ethBalanceNum.toFixed(6)} ETH, ${tokenBalanceNum.toFixed(6)} tokens`);

                // Transfer tokens first (if any)
                if (tokenBalanceNum > 0) {
                    const minKeptTokens = parseFloat(config.minKeptTokens);
                    const tokensToTransfer = tokenBalanceNum - minKeptTokens;

                    if (tokensToTransfer > 0) {
                        try {
                            const txRecord: Transaction = {
                                timestamp: new Date(),
                                type: 'token_transfer',
                                fromAddress: wallet.address,
                                toAddress: config.targetAddress,
                                amount: tokensToTransfer.toString(),
                                token: config.tokenAddress,
                                status: 'pending'
                            };
                            const txId = await this.database.saveTransaction(txRecord);

                            const receipt = await this.walletService.transferToken(
                                wallet,
                                config.tokenAddress,
                                config.targetAddress,
                                tokensToTransfer.toString()
                            );

                            await this.database.updateTransaction(txId, {
                                status: 'success',
                                txHash: receipt.hash,
                                gasUsed: receipt.gasUsed.toString()
                            });

                            this.log('success', `✓ Cleanup: Transferred ${tokensToTransfer} tokens from wallet ${i + 1}`);
                        } catch (error: any) {
                            this.log('error', `Failed to transfer tokens from wallet ${i + 1}: ${error.message}`);
                        }
                    }
                }

                // Transfer remaining ETH (account for gas costs)
                // Base transfer costs ~21000 gas, at 0.1 gwei that's 0.0000021 ETH
                // Keep a safe buffer of 0.0001 ETH for gas
                const gasBuffer = 0.0001;
                const ethToTransfer = ethBalanceNum - gasBuffer;

                if (ethToTransfer > 0.0001) { // Only transfer if we have enough after gas
                    try {
                        this.log('info', `Attempting to transfer ${ethToTransfer.toFixed(6)} ETH (balance: ${ethBalanceNum.toFixed(6)}, gas buffer: ${gasBuffer})`);
                        
                        const txRecord: Transaction = {
                            timestamp: new Date(),
                            type: 'eth_transfer',
                            fromAddress: wallet.address,
                            toAddress: config.targetAddress,
                            amount: ethToTransfer.toString(),
                            token: 'ETH',
                            status: 'pending'
                        };
                        const txId = await this.database.saveTransaction(txRecord);

                        const receipt = await this.walletService.transferETH(
                            wallet,
                            config.targetAddress,
                            ethToTransfer.toFixed(18)
                        );

                        await this.database.updateTransaction(txId, {
                            status: 'success',
                            txHash: receipt.hash,
                            gasUsed: receipt.gasUsed.toString()
                        });

                        this.log('success', `✓ Cleanup: Transferred ${ethToTransfer.toFixed(6)} ETH from wallet ${i + 1}`);
                    } catch (error: any) {
                        this.log('error', `Failed to transfer ETH from wallet ${i + 1}: ${error.message}`);
                    }
                } else {
                    this.log('info', `Wallet ${i + 1} has insufficient ETH for transfer after gas (${ethBalanceNum.toFixed(6)} ETH)`);
                }

                // Mark wallet as completed
                if (walletInfo.id) {
                    await this.database.updateWallet(walletInfo.id, { status: 'completed' });
                }

            } catch (error: any) {
                this.log('error', `Cleanup error for wallet ${i + 1}: ${error.message}`);
            }

            await this.delay(500);
        }

        this.log('success', 'Cleanup and consolidation completed');
    }

    /**
     * Stop the current operation
     */
    stopOperation(): void {
        if (this.isRunning) {
            this.shouldStop = true;
            this.log('warning', 'Stopping operation...');
        }
    }

    /**
     * Validate configuration
     */
    private validateConfig(config: AppConfig): void {
        if (!ethers.isAddress(config.tokenAddress)) {
            throw new Error('Invalid token address');
        }

        if (!ethers.isAddress(config.targetAddress)) {
            throw new Error('Invalid target address');
        }

        if (config.numWallets < 1 || config.numWallets > 1000) {
            throw new Error('Number of wallets must be between 1 and 1000');
        }

        if (parseFloat(config.gasAmount) <= 0) {
            throw new Error('Gas amount must be greater than 0');
        }

        if (parseFloat(config.purchaseAmount) <= 0) {
            throw new Error('Purchase amount must be greater than 0');
        }

        if (parseFloat(config.minKeptTokens) < 0) {
            throw new Error('Minimum kept tokens cannot be negative');
        }

        if (!config.rpcUrl || !config.rpcUrl.startsWith('http')) {
            throw new Error('Invalid RPC URL');
        }
    }

    /**
     * Log message
     */
    private log(level: 'info' | 'success' | 'warning' | 'error', message: string, data?: any): void {
        if (this.onLog) {
            this.onLog(level, message, data);
        }
    }

    /**
     * Update status
     */
    private updateStatus(status: OperationStatus): void {
        if (this.onStatusUpdate) {
            this.onStatusUpdate(status);
        }
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if operation is running
     */
    isOperationRunning(): boolean {
        return this.isRunning;
    }
}
