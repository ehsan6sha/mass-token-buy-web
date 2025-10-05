// Web3 Wallet Connection Service (MetaMask, WalletConnect, etc.)

import { ethers } from 'ethers';

export class WalletConnectService {
    private provider: ethers.BrowserProvider | null = null;
    private signer: ethers.Signer | null = null;
    private connectedAddress: string | null = null;

    /**
     * Check if wallet is available (MetaMask, etc.)
     */
    isWalletAvailable(): boolean {
        return typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';
    }

    /**
     * Connect to user's wallet
     */
    async connectWallet(): Promise<{ address: string; signer: ethers.Signer }> {
        if (!this.isWalletAvailable()) {
            throw new Error('No Web3 wallet detected. Please install MetaMask or use a Web3-enabled browser.');
        }

        try {
            // Request account access
            const ethereum = (window as any).ethereum;
            
            // Request accounts
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please unlock your wallet.');
            }

            // Create provider and signer
            this.provider = new ethers.BrowserProvider(ethereum);
            this.signer = await this.provider.getSigner();
            this.connectedAddress = accounts[0];

            console.log('Wallet connected:', this.connectedAddress);

            // Listen for account changes
            ethereum.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.connectedAddress = accounts[0];
                    console.log('Account changed:', this.connectedAddress);
                }
            });

            // Listen for chain changes
            ethereum.on('chainChanged', () => {
                window.location.reload();
            });

            return {
                address: this.connectedAddress!,
                signer: this.signer
            };
        } catch (error: any) {
            if (error.code === 4001) {
                throw new Error('Connection rejected by user');
            }
            throw new Error(`Failed to connect wallet: ${error.message}`);
        }
    }

    /**
     * Get current chain ID
     */
    async getCurrentChainId(): Promise<number> {
        if (!this.provider) {
            throw new Error('Wallet not connected');
        }

        const network = await this.provider.getNetwork();
        return Number(network.chainId);
    }

    /**
     * Switch to specific chain
     */
    async switchChain(chainId: number): Promise<void> {
        if (!this.provider) {
            throw new Error('Wallet not connected');
        }

        const ethereum = (window as any).ethereum;
        const hexChainId = '0x' + chainId.toString(16);

        try {
            await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId }],
            });
            console.log(`Switched to chain ${chainId}`);
        } catch (error: any) {
            // Chain doesn't exist in wallet, try to add it
            if (error.code === 4902) {
                await this.addChain(chainId);
            } else {
                throw error;
            }
        }
    }

    /**
     * Add a chain to wallet
     */
    private async addChain(chainId: number): Promise<void> {
        const ethereum = (window as any).ethereum;
        
        // Chain configurations
        const chainConfigs: { [key: number]: any } = {
            8453: { // Base
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
            },
            42161: { // Arbitrum
                chainId: '0xa4b1',
                chainName: 'Arbitrum One',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://arb1.arbitrum.io/rpc'],
                blockExplorerUrls: ['https://arbiscan.io']
            }
        };

        const config = chainConfigs[chainId];
        if (!config) {
            throw new Error(`Chain ${chainId} configuration not found`);
        }

        try {
            await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [config],
            });
            console.log(`Added and switched to chain ${chainId}`);
        } catch (error) {
            throw new Error(`Failed to add chain ${chainId}: ${error}`);
        }
    }

    /**
     * Send batch transaction (multiple transfers in one tx using multicall if available)
     */
    async sendBatchTransfer(recipients: string[], amounts: string[]): Promise<ethers.TransactionReceipt> {
        if (!this.signer) {
            throw new Error('Wallet not connected');
        }

        if (recipients.length !== amounts.length) {
            throw new Error('Recipients and amounts length mismatch');
        }

        // For now, we'll send individual transactions rapidly
        // In a production app, you'd use a multicall contract
        console.log(`Preparing to send ${recipients.length} transfers...`);
        
        const totalAmount = amounts.reduce((sum, amount) => {
            return sum + ethers.parseEther(amount);
        }, BigInt(0));

        console.log(`Total amount to transfer: ${ethers.formatEther(totalAmount)} ETH`);

        // Get current nonce
        let nonce = await this.signer.getNonce();

        // Send all transactions with sequential nonces
        const txPromises: Promise<ethers.TransactionResponse>[] = [];
        
        for (let i = 0; i < recipients.length; i++) {
            const tx = {
                to: recipients[i],
                value: ethers.parseEther(amounts[i]),
                nonce: nonce + i
            };
            
            txPromises.push(this.signer.sendTransaction(tx));
        }

        // Wait for all transactions to be sent
        const txResponses = await Promise.all(txPromises);
        
        console.log(`All ${txResponses.length} transactions sent!`);
        console.log('First tx hash:', txResponses[0].hash);
        console.log('Last tx hash:', txResponses[txResponses.length - 1].hash);

        // Wait for the last transaction to confirm (they should all confirm together)
        const lastReceipt = await txResponses[txResponses.length - 1].wait();
        
        if (!lastReceipt || lastReceipt.status !== 1) {
            throw new Error('Batch transfer failed');
        }

        return lastReceipt;
    }

    /**
     * Disconnect wallet
     */
    disconnect(): void {
        this.provider = null;
        this.signer = null;
        this.connectedAddress = null;
        console.log('Wallet disconnected');
    }

    /**
     * Get connected address
     */
    getAddress(): string | null {
        return this.connectedAddress;
    }

    /**
     * Get signer
     */
    getSigner(): ethers.Signer | null {
        return this.signer;
    }

    /**
     * Get balance
     */
    async getBalance(): Promise<string> {
        if (!this.provider || !this.connectedAddress) {
            throw new Error('Wallet not connected');
        }

        const balance = await this.provider.getBalance(this.connectedAddress);
        return ethers.formatEther(balance);
    }
}
