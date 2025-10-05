// Wallet management using ethers.js

import { ethers } from 'ethers';
import { CryptoService } from './crypto';
import { WalletInfo } from './types';

export class WalletService {
    private provider: ethers.JsonRpcProvider;

    constructor(rpcUrl: string) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    /**
     * Create a new random wallet
     */
    async createWallet(password: string): Promise<{ wallet: ethers.Wallet; info: WalletInfo }> {
        try {
            // Generate new random wallet
            const randomWallet = ethers.Wallet.createRandom();
            const wallet = new ethers.Wallet(randomWallet.privateKey, this.provider);

            // Encrypt private key
            const encryptedPrivateKey = await CryptoService.encrypt(wallet.privateKey, password);

            const info: WalletInfo = {
                address: wallet.address,
                encryptedPrivateKey: encryptedPrivateKey,
                createdAt: new Date(),
                status: 'created'
            };

            return { wallet, info };
        } catch (error) {
            throw new Error(`Failed to create wallet: ${error}`);
        }
    }

    /**
     * Load wallet from encrypted private key
     */
    async loadWallet(encryptedPrivateKey: string, password: string): Promise<ethers.Wallet> {
        try {
            const privateKey = await CryptoService.decrypt(encryptedPrivateKey, password);
            return new ethers.Wallet(privateKey, this.provider);
        } catch (error) {
            throw new Error(`Failed to load wallet: ${error}`);
        }
    }

    /**
     * Load wallet from plain private key
     */
    getWalletFromPrivateKey(privateKey: string): ethers.Wallet {
        try {
            // Ensure private key has 0x prefix
            const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            return new ethers.Wallet(formattedKey, this.provider);
        } catch (error) {
            throw new Error(`Failed to load wallet from private key: ${error}`);
        }
    }

    /**
     * Get ETH balance of an address
     */
    async getBalance(address: string): Promise<string> {
        try {
            const balance = await this.provider.getBalance(address);
            return ethers.formatEther(balance);
        } catch (error) {
            throw new Error(`Failed to get balance: ${error}`);
        }
    }

    /**
     * Get ERC20 token balance
     */
    async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
        try {
            const tokenAbi = [
                'function balanceOf(address owner) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ];

            const contract = new ethers.Contract(tokenAddress, tokenAbi, this.provider);
            const [balance, decimals] = await Promise.all([
                contract.balanceOf(walletAddress),
                contract.decimals()
            ]);

            return ethers.formatUnits(balance, decimals);
        } catch (error) {
            throw new Error(`Failed to get token balance: ${error}`);
        }
    }

    /**
     * Transfer ETH from one wallet to another
     */
    async transferETH(
        fromWallet: ethers.Wallet,
        toAddress: string,
        amount: string
    ): Promise<ethers.TransactionReceipt> {
        try {
            const tx = await fromWallet.sendTransaction({
                to: toAddress,
                value: ethers.parseEther(amount)
            });

            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error('Transaction receipt is null');
            }

            return receipt;
        } catch (error) {
            throw new Error(`Failed to transfer ETH: ${error}`);
        }
    }

    /**
     * Transfer ERC20 tokens
     */
    async transferToken(
        fromWallet: ethers.Wallet,
        tokenAddress: string,
        toAddress: string,
        amount: string
    ): Promise<ethers.TransactionReceipt> {
        try {
            const tokenAbi = [
                'function transfer(address to, uint256 amount) returns (bool)',
                'function decimals() view returns (uint8)'
            ];

            const contract = new ethers.Contract(tokenAddress, tokenAbi, fromWallet);
            const decimals = await contract.decimals();
            const amountInWei = ethers.parseUnits(amount, decimals);

            const tx = await contract.transfer(toAddress, amountInWei);
            const receipt = await tx.wait();

            if (!receipt) {
                throw new Error('Transaction receipt is null');
            }

            return receipt;
        } catch (error) {
            throw new Error(`Failed to transfer tokens: ${error}`);
        }
    }

    /**
     * Get current gas price
     */
    async getGasPrice(): Promise<bigint> {
        try {
            const feeData = await this.provider.getFeeData();
            return feeData.gasPrice || ethers.parseUnits('1', 'gwei');
        } catch (error) {
            throw new Error(`Failed to get gas price: ${error}`);
        }
    }

    /**
     * Estimate gas for ETH transfer
     */
    async estimateGasForTransfer(to: string, amount: string): Promise<bigint> {
        try {
            return await this.provider.estimateGas({
                to: to,
                value: ethers.parseEther(amount)
            });
        } catch (error) {
            // Return a default estimate if estimation fails
            return BigInt(21000);
        }
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForTransaction(txHash: string, confirmations: number = 1): Promise<ethers.TransactionReceipt | null> {
        try {
            return await this.provider.waitForTransaction(txHash, confirmations);
        } catch (error) {
            throw new Error(`Failed to wait for transaction: ${error}`);
        }
    }

    /**
     * Get transaction by hash
     */
    async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
        try {
            return await this.provider.getTransaction(txHash);
        } catch (error) {
            throw new Error(`Failed to get transaction: ${error}`);
        }
    }

    /**
     * Update provider RPC URL
     */
    updateProvider(rpcUrl: string): void {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
}
