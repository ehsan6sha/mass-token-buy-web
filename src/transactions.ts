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

                const { wallet, dbId, purchaseAmount } = wallets[i];
                const amountToSend = (gasAmount + purchaseAmount).toFixed(18);

                try {
                    this.log('info', `Funding wallet ${i + 1}/${wallets.length}: ${wallet.address} with ${amountToSend} ETH (${purchaseAmount.toFixed(8)} for purchase)`);
                    
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

                const { wallet, dbId, purchaseAmount } = wallets[i];

                try {
                    // Format purchase amount to max 18 decimals (ETH precision)
                    const formattedAmount = purchaseAmount.toFixed(18);
                    this.log('info', `Swapping ${purchaseAmount.toFixed(8)} ETH for tokens in wallet ${i + 1}/${wallets.length}`);

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
                    const swapResult = await this.dexService.swapETHToToken(
                        wallet,
                        config.tokenAddress,
                        formattedAmount,
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

                    // Transfer remaining ETH - calculate proper amount after gas costs
                    const ethBalanceWei = await wallet.provider!.getBalance(wallet.address);
                    const ethBalanceNum = parseFloat(ethers.formatEther(ethBalanceWei));

                    if (ethBalanceNum > 0.00001) { // Only transfer if significant amount
                        // Estimate gas for ETH transfer
                        const gasEstimate = await wallet.estimateGas({
                            to: config.targetAddress,
                            value: ethers.parseEther('0.00001') // Dummy amount for estimation
                        });
                        
                        // Get current gas price
                        const feeData = await wallet.provider!.getFeeData();
                        const gasPrice = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');
                        
                        // Calculate gas cost in ETH
                        const gasCostWei = gasEstimate * gasPrice;
                        const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));
                        
                        // Amount to transfer = balance - gas cost (with 10% buffer)
                        const ethToTransfer = ethBalanceNum - (gasCostEth * 1.1);

                        if (ethToTransfer > 0.00001) {
                            const txRecord: Transaction = {
                                timestamp: new Date(),
                                type: 'eth_transfer',
                                fromAddress: wallet.address,
                                toAddress: config.targetAddress,
                                amount: ethToTransfer.toFixed(18),
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

                            this.log('success', `✓ Transferred ${ethToTransfer.toFixed(6)} ETH (gas: ${gasCostEth.toFixed(8)}): ${receipt.hash}`);
                        } else {
                            this.log('warning', `Wallet ${i + 1}: Insufficient ETH after gas costs (balance: ${ethBalanceNum.toFixed(8)}, gas: ${gasCostEth.toFixed(8)})`);
                        }
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

            // Transfer tokens if any
            const tokenBalance = await this.walletService.getTokenBalance(
                config.tokenAddress,
                wallet.address
            );

            const minKeptTokens = parseFloat(config.minKeptTokens);
            const tokensToTransfer = parseFloat(tokenBalance) - minKeptTokens;

            if (tokensToTransfer > 0) {
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
            }

            // Transfer ETH
            const ethBalanceWei = await wallet.provider!.getBalance(wallet.address);
            const ethBalanceNum = parseFloat(ethers.formatEther(ethBalanceWei));

            if (ethBalanceNum > 0.00001) {
                // Use custom gas limit if provided, otherwise estimate
                let gasEstimate: bigint;
                if (customGasLimit) {
                    gasEstimate = BigInt(customGasLimit);
                    this.log('info', `Using custom gas limit: ${customGasLimit}`);
                } else {
                    gasEstimate = await wallet.estimateGas({
                        to: targetAddress,
                        value: ethers.parseEther('0.00001')
                    });
                    this.log('info', `Estimated gas: ${gasEstimate.toString()}`);
                }
                
                // Get current gas price
                const feeData = await wallet.provider!.getFeeData();
                const gasPrice = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');
                
                // Calculate gas cost
                const gasCostWei = gasEstimate * gasPrice;
                const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));
                
                // Amount to transfer = balance - gas cost (with 10% buffer for estimation variance)
                const ethToTransfer = ethBalanceNum - (gasCostEth * 1.1);

                if (ethToTransfer > 0) {
                    this.log('info', `Transferring ${ethToTransfer.toFixed(6)} ETH (balance: ${ethBalanceNum.toFixed(8)}, gas: ${gasCostEth.toFixed(8)})`);
                    
                    const txRecord: Transaction = {
                        timestamp: new Date(),
                        type: 'eth_transfer',
                        fromAddress: wallet.address,
                        toAddress: targetAddress,
                        amount: ethToTransfer.toFixed(18),
                        token: 'ETH',
                        status: 'pending'
                    };
                    const txId = await this.database.saveTransaction(txRecord);

                    const receipt = await this.walletService.transferETH(
                        wallet,
                        targetAddress,
                        ethToTransfer.toFixed(18)
                    );

                    await this.database.updateTransaction(txId, {
                        status: 'success',
                        txHash: receipt.hash,
                        gasUsed: receipt.gasUsed.toString()
                    });

                    this.log('success', `✓ Transferred ${ethToTransfer.toFixed(6)} ETH: ${receipt.hash}`);
                } else {
                    this.log('warning', `Insufficient ETH after gas costs (balance: ${ethBalanceNum.toFixed(8)}, gas: ${gasCostEth.toFixed(8)})`);
                }
            } else {
                this.log('info', `No ETH to transfer (balance: ${ethBalanceNum.toFixed(8)})`);
            }

            // Update wallet status
            await this.database.updateWallet(walletId, { status: 'completed' });
            this.log('success', '✓ Manual transfer completed successfully');

        } catch (error: any) {
            this.log('error', `Manual transfer failed: ${error.message}`, error);
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
