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
    
    // Watchdog mechanism
    private lastActivityTime: number = Date.now();
    private watchdogTimer: NodeJS.Timeout | null = null;
    private watchdogTimeout: number = 60000; // 60 seconds
    private currentOperation: string = 'idle';
    private isStuck: boolean = false;
    
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
        this.startWatchdog();

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
            this.updateActivity('Starting operation');
            
            // Step 1: Validate configuration
            this.log('info', 'Validating configuration...');
            this.updateActivity('Validating configuration');
            this.validateConfig(config);
            status.currentStep = 'Configuration validated';
            this.updateStatus(status);

            // Update DEX configuration
            this.dexService.updateConfig(config.chain, config.dex, config.rpcUrl || undefined);
            this.log('info', `Using ${config.dex} on ${config.chain}`);

            // Step 2: Load master wallet
            this.log('info', 'Loading master wallet...');
            this.updateActivity('Loading master wallet');
            const masterWallet = this.walletService.getWalletFromPrivateKey(config.masterPrivateKey);
            const masterBalance = await this.walletService.getBalance(masterWallet.address);
            this.log('success', `Master wallet loaded: ${masterWallet.address}`);
            this.log('info', `Master wallet balance: ${masterBalance} ETH`);

            // Calculate random purchase allocations
            const gasAmount = parseFloat(config.gasAmount);
            const minPurchase = parseFloat(config.minPurchaseAmount);
            const maxPurchase = parseFloat(config.maxPurchaseAmount);
            const availableBalance = parseFloat(masterBalance);
            
            // Calculate total gas needed for all wallets
            const totalGasNeeded = gasAmount * config.numWallets;
            const availableForPurchases = availableBalance - totalGasNeeded;
            
            this.log('info', `Available balance: ${availableBalance.toFixed(6)} ETH`);
            this.log('info', `Total gas reserved: ${totalGasNeeded.toFixed(6)} ETH`);
            this.log('info', `Available for purchases: ${availableForPurchases.toFixed(6)} ETH`);
            
            // Generate random allocations
            const purchaseAllocations = this.generateRandomAllocations(
                config.numWallets,
                availableForPurchases,
                minPurchase,
                maxPurchase
            );
            
            const totalPurchaseAmount = purchaseAllocations.reduce((sum, val) => sum + val, 0);
            const totalETHNeeded = totalGasNeeded + totalPurchaseAmount;
            
            this.log('info', `Total purchase amount: ${totalPurchaseAmount.toFixed(6)} ETH`);
            this.log('info', `Total ETH needed: ${totalETHNeeded.toFixed(6)} ETH`);
            this.log('info', `Purchase amounts range: ${Math.min(...purchaseAllocations).toFixed(8)} - ${Math.max(...purchaseAllocations).toFixed(8)} ETH`);

            if (totalETHNeeded > availableBalance) {
                throw new Error(`Insufficient balance. Need ${totalETHNeeded.toFixed(6)} ETH, have ${masterBalance} ETH`);
            }

            // Step 3: Create wallets
            this.log('info', `Creating ${config.numWallets} wallets...`);
            this.updateActivity('Creating wallets');
            status.currentStep = 'Creating wallets';
            this.updateStatus(status);

            const wallets: { wallet: ethers.Wallet; info: WalletInfo; dbId: number; purchaseAmount: number }[] = [];

            for (let i = 0; i < config.numWallets; i++) {
                if (this.shouldStop) {
                    this.log('warning', 'Operation stopped by user');
                    break;
                }

                const { wallet, info } = await this.walletService.createWallet(password);
                const dbId = await this.database.saveWallet(info);
                const purchaseAmount = purchaseAllocations[i];
                wallets.push({ wallet, info, dbId, purchaseAmount });

                status.walletsCreated++;
                status.progress = (i + 1) / (config.numWallets * 4) * 100; // 4 main steps
                this.updateStatus(status);
                this.updateActivity(`Created wallet ${i + 1}/${config.numWallets}`);

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
            this.updateActivity('Funding wallets');
            status.currentStep = 'Funding wallets';
            this.updateStatus(status);

            for (let i = 0; i < wallets.length; i++) {
                if (this.shouldStop) break;

                const { wallet, dbId, purchaseAmount } = wallets[i];
                const amountToSend = (gasAmount + purchaseAmount).toFixed(18);

                try {
                    this.log('info', `Funding wallet ${i + 1}/${wallets.length}: ${wallet.address} with ${amountToSend} ETH (${purchaseAmount.toFixed(8)} for purchase)`);
                    this.updateActivity(`Funding wallet ${i + 1}/${wallets.length}`);
                    
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
            this.updateActivity('Swapping tokens');
            status.currentStep = 'Swapping tokens';
            this.updateStatus(status);

            for (let i = 0; i < wallets.length; i++) {
                if (this.shouldStop) break;

                const { wallet, dbId, purchaseAmount } = wallets[i];

                try {
                    this.updateActivity(`Swapping in wallet ${i + 1}/${wallets.length}`);
                    // Check actual wallet balance and reserve gas
                    const actualBalance = await wallet.provider!.getBalance(wallet.address);
                    
                    // Get gas price
                    const feeData = await wallet.provider!.getFeeData();
                    const gasPrice = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');
                    
                    // Reserve gas for swap (swaps use ~300k-500k gas, use 500k with 50% buffer)
                    const swapGasLimit = BigInt(500000);
                    const gasReserveWei = swapGasLimit * gasPrice * BigInt(150) / BigInt(100);
                    
                    // Calculate available amount for swap
                    const availableForSwapWei = actualBalance - gasReserveWei;
                    const availableForSwap = parseFloat(ethers.formatEther(availableForSwapWei));
                    
                    // Use the lesser of allocated amount or available amount
                    const actualSwapAmount = Math.min(purchaseAmount, Math.max(0, availableForSwap));
                    
                    if (actualSwapAmount <= 0) {
                        this.log('error', `Wallet ${i + 1}: Insufficient balance for swap after gas (balance: ${ethers.formatEther(actualBalance)})`);
                        continue;
                    }
                    
                    const formattedAmount = actualSwapAmount.toFixed(18);
                    this.log('info', `Swapping ${actualSwapAmount.toFixed(8)} ETH for tokens in wallet ${i + 1}/${wallets.length} (allocated: ${purchaseAmount.toFixed(8)})`);

                    // Create transaction record
                    const txRecord: Transaction = {
                        timestamp: new Date(),
                        type: 'token_swap',
                        fromAddress: wallet.address,
                        toAddress: wallet.address,
                        amount: formattedAmount,
                        token: config.tokenAddress,
                        status: 'pending'
                    };
                    const txId = await this.database.saveTransaction(txRecord);

                    // Execute swap using DEX with automatic gas management
                    this.updateActivity(`Executing swap for wallet ${i + 1}/${wallets.length}`);
                    const swapResult = await this.dexService.swapETHToToken(
                        wallet,
                        config.tokenAddress,
                        formattedAmount,
                        0.5 // 0.5% slippage
                    );
                    this.updateActivity(`Swap completed for wallet ${i + 1}/${wallets.length}`);

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
            this.updateActivity('Transferring to target');
            status.currentStep = 'Transferring to target';
            this.updateStatus(status);

            for (let i = 0; i < wallets.length; i++) {
                if (this.shouldStop) break;

                const { wallet, dbId } = wallets[i];

                try {
                    this.log('info', `Transferring from wallet ${i + 1}/${wallets.length}`);
                    this.updateActivity(`Transferring from wallet ${i + 1}/${wallets.length}`);

                    // Get token balance
                    const tokenBalance = await this.walletService.getTokenBalance(
                        config.tokenAddress,
                        wallet.address
                    );

                    const tokenBalanceNum = parseFloat(tokenBalance);
                    const minKeptTokens = parseFloat(config.minKeptTokens);
                    const tokensToTransfer = tokenBalanceNum - minKeptTokens;

                    // Only transfer if amount is significant (> 0.000001 tokens)
                    if (tokensToTransfer > 0.000001) {
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

                        try {
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
                        } catch (error: any) {
                            await this.database.updateTransaction(txId, { status: 'failed', error: error.message });
                            this.log('warning', `Wallet ${i + 1}: Token transfer failed (${tokensToTransfer}): ${error.message}`);
                        }
                    } else {
                        this.log('info', `Wallet ${i + 1}: Skipping token transfer (balance: ${tokenBalanceNum}, min kept: ${minKeptTokens})`);
                    }

                    // Transfer remaining ETH - use BigInt for precision
                    const ethBalanceWei = await wallet.provider!.getBalance(wallet.address);
                    const ethBalanceNum = parseFloat(ethers.formatEther(ethBalanceWei));

                    if (ethBalanceWei > BigInt(10000000000000)) { // > 0.00001 ETH
                        // Get current gas price
                        const feeData = await wallet.provider!.getFeeData();
                        const gasPrice = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');
                        
                        // Calculate gas cost with 2x buffer - ALL in wei
                        const gasLimit = BigInt(21000);
                        const maxGasCostWei = gasLimit * gasPrice * BigInt(2);
                        
                        // Amount to transfer = balance - gas reserve (in wei)
                        const transferWei = ethBalanceWei - maxGasCostWei;

                        if (transferWei > 0) {
                            const ethToTransfer = ethers.formatEther(transferWei);
                            const estimatedGas = ethers.formatEther(maxGasCostWei);
                            
                            const txRecord: Transaction = {
                                timestamp: new Date(),
                                type: 'eth_transfer',
                                fromAddress: wallet.address,
                                toAddress: config.targetAddress,
                                amount: ethToTransfer,
                                token: 'ETH',
                                status: 'pending'
                            };
                            const txId = await this.database.saveTransaction(txRecord);

                            const receipt = await this.walletService.transferETH(
                                wallet,
                                config.targetAddress,
                                ethToTransfer
                            );

                            await this.database.updateTransaction(txId, {
                                status: 'success',
                                txHash: receipt.hash,
                                gasUsed: receipt.gasUsed.toString()
                            });

                            this.log('success', `✓ Transferred ${parseFloat(ethToTransfer).toFixed(6)} ETH (reserved: ${parseFloat(estimatedGas).toFixed(8)}): ${receipt.hash}`);
                        } else {
                            this.log('warning', `Wallet ${i + 1}: Insufficient ETH after gas reserve (balance: ${ethBalanceNum.toFixed(8)})`);
                        }
                    }

                    // Update wallet status
                    await this.database.updateWallet(dbId, { status: 'completed' });

                    status.tokensTransferred++;
                    status.progress = (config.numWallets * 3 + i + 1) / (config.numWallets * 4) * 100;
                    this.updateStatus(status);

                } catch (error: any) {
                    this.log('error', `Failed to transfer from wallet ${i + 1}: ${error.message}`, error);
                    
                    // Mark as completed even if transfer failed
                    try {
                        await this.database.updateWallet(dbId, { status: 'completed' });
                    } catch (dbError) {
                        this.log('error', `Failed to update wallet status: ${dbError}`);
                    }
                }

                await this.delay(500);
            }

            status.currentStep = 'Completed';
            status.progress = 100;
            status.isRunning = false;
            this.updateStatus(status);

            this.log('success', '🎉 Mass token buy operation completed successfully!');
            this.updateActivity('Completed');
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
            this.stopWatchdog();
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
     * Start the watchdog timer
     */
    private startWatchdog(): void {
        this.lastActivityTime = Date.now();
        this.isStuck = false;
        this.currentOperation = 'Starting';
        
        // Check every 10 seconds
        this.watchdogTimer = setInterval(() => {
            this.checkWatchdog();
        }, 10000);
        
        this.log('info', '🐕 Watchdog started (will alert if stuck for >60s)');
    }

    /**
     * Stop the watchdog timer
     */
    private stopWatchdog(): void {
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
            this.log('info', '🐕 Watchdog stopped');
        }
    }

    /**
     * Update last activity time
     */
    private updateActivity(operation: string): void {
        this.lastActivityTime = Date.now();
        this.currentOperation = operation;
        this.isStuck = false; // Reset stuck flag
    }

    /**
     * Check if operation is stuck
     */
    private checkWatchdog(): void {
        const timeSinceLastActivity = Date.now() - this.lastActivityTime;
        
        if (timeSinceLastActivity > this.watchdogTimeout) {
            if (!this.isStuck) {
                // First time detecting stuck state
                this.isStuck = true;
                this.log('warning', `⚠️ WATCHDOG ALERT: Operation appears stuck! Last activity: "${this.currentOperation}" (${Math.floor(timeSinceLastActivity / 1000)}s ago)`);
                this.log('warning', 'Watchdog will continue monitoring. If this persists, the operation may need manual intervention.');
                
                // Try to force a status update to trigger any pending UI updates
                if (this.onStatusUpdate) {
                    const status = {
                        isRunning: this.isRunning,
                        walletsCreated: 0,
                        ethTransferred: 0,
                        swapsCompleted: 0,
                        tokensTransferred: 0,
                        currentStep: `⚠️ Stuck at: ${this.currentOperation}`,
                        progress: 0
                    };
                    this.onStatusUpdate(status);
                }
            } else if (timeSinceLastActivity > this.watchdogTimeout * 2) {
                // Been stuck for more than 2 minutes
                this.log('error', `❌ CRITICAL: Operation stuck for ${Math.floor(timeSinceLastActivity / 1000)}s. Last activity: "${this.currentOperation}"`);
                this.log('error', 'Consider stopping the operation and checking the logs.');
            }
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

        if (parseFloat(config.minPurchaseAmount) <= 0) {
            throw new Error('Minimum purchase amount must be greater than 0');
        }

        if (parseFloat(config.maxPurchaseAmount) <= 0) {
            throw new Error('Maximum purchase amount must be greater than 0');
        }

        if (parseFloat(config.minPurchaseAmount) > parseFloat(config.maxPurchaseAmount)) {
            throw new Error('Minimum purchase amount cannot exceed maximum purchase amount');
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

    /**
     * Manual transfer back from a specific wallet
     */
    async transferBackFromWallet(
        walletId: number,
        password: string,
        targetAddress: string,
        customGasLimit?: number
    ): Promise<void> {
        try {
            // Load wallet from database
            const walletInfo = await this.database.getWallet(walletId);
            if (!walletInfo) {
                throw new Error('Wallet not found');
            }

            const wallet = await this.walletService.loadWallet(walletInfo.encryptedPrivateKey, password);
            this.log('info', `Manually transferring from wallet: ${wallet.address}`);

            // Get token balance (use last config if available)
            const config = await this.database.getConfig();
            if (!config) {
                throw new Error('No configuration found. Cannot determine token address.');
            }

            // Transfer tokens if balance is significant
            const tokenBalance = await this.walletService.getTokenBalance(
                config.tokenAddress,
                wallet.address
            );

            const tokenBalanceNum = parseFloat(tokenBalance);
            const minKeptTokens = parseFloat(config.minKeptTokens);
            const tokensToTransfer = tokenBalanceNum - minKeptTokens;

            // Only transfer if amount is significant (> 0.000001 tokens)
            if (tokensToTransfer > 0.000001) {
                this.log('info', `Transferring ${tokensToTransfer} tokens to ${targetAddress}`);
                
                const txRecord: Transaction = {
                    timestamp: new Date(),
                    type: 'token_transfer',
                    fromAddress: wallet.address,
                    toAddress: targetAddress,
                    amount: tokensToTransfer.toString(),
                    token: config.tokenAddress,
                    status: 'pending'
                };
                const txId = await this.database.saveTransaction(txRecord);

                try {
                    const receipt = await this.walletService.transferToken(
                        wallet,
                        config.tokenAddress,
                        targetAddress,
                        tokensToTransfer.toString()
                    );

                    await this.database.updateTransaction(txId, {
                        status: 'success',
                        txHash: receipt.hash,
                        gasUsed: receipt.gasUsed.toString()
                    });

                    this.log('success', `✓ Transferred ${tokensToTransfer} tokens: ${receipt.hash}`);
                } catch (error: any) {
                    await this.database.updateTransaction(txId, { status: 'failed', error: error.message });
                    this.log('warning', `Failed to transfer tokens (${tokensToTransfer}): ${error.message}`);
                }
            } else {
                this.log('info', `Skipping token transfer (balance: ${tokenBalanceNum}, min kept: ${minKeptTokens})`);
            }

            // Transfer ETH - use BigInt calculations to avoid precision errors
            const ethBalanceWei = await wallet.provider!.getBalance(wallet.address);
            const ethBalanceNum = parseFloat(ethers.formatEther(ethBalanceWei));

            if (ethBalanceWei > BigInt(10000000000000)) { // > 0.00001 ETH
                this.log('info', `Wallet balance: ${ethBalanceNum.toFixed(8)} ETH`);
                
                // Get current gas price
                const feeData = await wallet.provider!.getFeeData();
                const gasPrice = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');
                
                // Use custom gas limit if provided, otherwise use safe default
                const gasLimit = customGasLimit ? BigInt(customGasLimit) : BigInt(21000);
                
                // Calculate gas cost with 2x buffer (100% extra) - ALL in wei to avoid rounding
                const maxGasCostWei = gasLimit * gasPrice * BigInt(2);
                
                // Amount to transfer = balance - gas reserve (ALL in wei)
                const transferWei = ethBalanceWei - maxGasCostWei;

                if (transferWei > 0) {
                    const ethToTransfer = ethers.formatEther(transferWei);
                    const estimatedGas = ethers.formatEther(maxGasCostWei);
                    
                    this.log('info', `Transferring ${parseFloat(ethToTransfer).toFixed(8)} ETH (reserved: ${parseFloat(estimatedGas).toFixed(8)})`);
                    
                    const txRecord: Transaction = {
                        timestamp: new Date(),
                        type: 'eth_transfer',
                        fromAddress: wallet.address,
                        toAddress: targetAddress,
                        amount: ethToTransfer,
                        token: 'ETH',
                        status: 'pending'
                    };
                    const txId = await this.database.saveTransaction(txRecord);

                    try {
                        const receipt = await this.walletService.transferETH(
                            wallet,
                            targetAddress,
                            ethToTransfer
                        );

                        await this.database.updateTransaction(txId, {
                            status: 'success',
                            txHash: receipt.hash,
                            gasUsed: receipt.gasUsed.toString()
                        });

                        this.log('success', `✓ Transferred ${parseFloat(ethToTransfer).toFixed(6)} ETH: ${receipt.hash}`);
                    } catch (error: any) {
                        await this.database.updateTransaction(txId, { status: 'failed', error: error.message });
                        this.log('warning', `ETH transfer failed: ${error.message}`);
                    }
                } else {
                    this.log('info', `Skipping ETH transfer (insufficient after gas, balance: ${ethBalanceNum.toFixed(8)})`);
                }
            } else {
                this.log('info', `Skipping ETH transfer (balance too low: ${ethBalanceNum.toFixed(8)})`);
            }

            // Update wallet status to completed regardless of transfer outcomes
            await this.database.updateWallet(walletId, { status: 'completed' });
            this.log('success', '✓ Transfer back completed');

        } catch (error: any) {
            // Log error but don't throw - mark wallet as completed anyway
            this.log('error', `Transfer back error: ${error.message}`, error);
            
            // Try to mark wallet as completed even if there was an error
            try {
                await this.database.updateWallet(walletId, { status: 'completed' });
            } catch (dbError) {
                this.log('error', `Failed to update wallet status: ${dbError}`);
            }
            
            throw error;
        }
    }

    /**
     * Generate random allocations for purchase amounts
     * Uses bounded random distribution to ensure fair allocation within constraints
     */
    private generateRandomAllocations(
        numWallets: number,
        totalAvailable: number,
        minAmount: number,
        maxAmount: number
    ): number[] {
        // Step 1: Check feasibility
        const minRequired = numWallets * minAmount;
        const maxPossible = numWallets * maxAmount;

        if (totalAvailable < minRequired) {
            throw new Error(
                `Insufficient funds for allocation. Need at least ${minRequired.toFixed(6)} ETH, ` +
                `but only ${totalAvailable.toFixed(6)} ETH available after gas reserves.`
            );
        }

        if (totalAvailable > maxPossible) {
            this.log('warning', `Available funds (${totalAvailable.toFixed(6)} ETH) exceed maximum allocation ` +
                `(${maxPossible.toFixed(6)} ETH). Will allocate up to maximum.`);
        }

        // Step 2: Initialize allocations at minimum
        const allocations = new Array(numWallets).fill(minAmount);
        let remaining = totalAvailable - minRequired;

        // Step 3: Distribute remaining amount randomly while respecting max bounds
        for (let i = 0; i < numWallets - 1; i++) {
            // Maximum we can safely assign to this wallet
            const maxCanAdd = maxAmount - minAmount;
            const maxSafeAdd = Math.min(maxCanAdd, remaining);
            
            if (maxSafeAdd > 0) {
                // Random amount between 0 and maxSafeAdd
                const add = Math.random() * maxSafeAdd;
                allocations[i] += add;
                remaining -= add;
            }
        }

        // Step 4: Give remaining to last wallet, capped at max
        const lastWalletMax = maxAmount - minAmount;
        const toAdd = Math.min(lastWalletMax, remaining);
        allocations[numWallets - 1] += toAdd;

        return allocations;
    }
}
