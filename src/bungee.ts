// Bungee Exchange API integration

import axios from 'axios';
import { ethers } from 'ethers';
import { BungeeQuoteRequest, BungeeQuoteResponse } from './types';

export class BungeeService {
    private static readonly API_BASE_URL = 'https://api.bungee.exchange';
    private static readonly QUOTE_ENDPOINT = '/v1/quote';
    // CORS proxy for development/localhost (remove for production or use deployed domain)
    private static readonly CORS_PROXY = 'https://corsproxy.io/?';
    private apiKey?: string;
    private useCorsProxy: boolean;

    constructor(apiKey?: string, useCorsProxy: boolean = false) {
        this.apiKey = apiKey;
        this.useCorsProxy = useCorsProxy;
    }

    /**
     * Get a quote for swapping tokens
     */
    async getQuote(request: BungeeQuoteRequest): Promise<BungeeQuoteResponse> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this.apiKey) {
                headers['x-api-key'] = this.apiKey;
            }

            // Use CORS proxy if enabled (for localhost development)
            const apiUrl = this.useCorsProxy
                ? `${BungeeService.CORS_PROXY}${encodeURIComponent(BungeeService.API_BASE_URL + BungeeService.QUOTE_ENDPOINT)}`
                : `${BungeeService.API_BASE_URL}${BungeeService.QUOTE_ENDPOINT}`;

            const response = await axios.post(
                apiUrl,
                request,
                { headers }
            );

            if (!response.data || !response.data.tx) {
                throw new Error('Invalid response from Bungee API');
            }

            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                const errorMsg = error.response?.data?.message || error.response?.data || error.message;
                throw new Error(`Bungee API error: ${errorMsg}`);
            }
            throw new Error(`Failed to get quote: ${error}`);
        }
    }

    /**
     * Execute a swap transaction
     */
    async executeSwap(
        wallet: ethers.Wallet,
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string,
        slippage: number = 0.5
    ): Promise<{
        txHash: string;
        receipt: ethers.TransactionReceipt;
        estimatedOutput: string;
    }> {
        try {
            // Build quote request
            const quoteRequest: BungeeQuoteRequest = {
                fromChainId: 8453, // Base Mainnet
                fromTokenAddress: fromTokenAddress,
                fromAmount: amount,
                toChainId: 8453, // Base Mainnet
                toTokenAddress: toTokenAddress,
                senderAddress: wallet.address,
                recipientAddress: wallet.address,
                slippage: slippage
            };

            // Get quote
            const quote = await this.getQuote(quoteRequest);

            // Check if approval is needed (shouldn't be for native ETH)
            if (quote.approvalData) {
                console.warn('Approval data received for native ETH swap - this is unexpected');
                // If needed, handle approval here
            }

            // Prepare transaction
            const tx: ethers.TransactionRequest = {
                to: quote.tx.to,
                data: quote.tx.data,
                value: ethers.toBigInt(quote.tx.value || '0'),
                gasLimit: ethers.toBigInt(quote.tx.gasLimit || '500000')
            };

            // Get current gas prices
            const feeData = await wallet.provider!.getFeeData();
            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                tx.maxFeePerGas = feeData.maxFeePerGas;
                tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
            } else if (feeData.gasPrice) {
                tx.gasPrice = feeData.gasPrice;
            }

            // Send transaction
            const sentTx = await wallet.sendTransaction(tx);
            
            // Wait for confirmation
            const receipt = await sentTx.wait();

            if (!receipt) {
                throw new Error('Transaction receipt is null');
            }

            if (receipt.status !== 1) {
                throw new Error('Transaction failed or was reverted');
            }

            return {
                txHash: receipt.hash,
                receipt: receipt,
                estimatedOutput: quote.toAmount
            };
        } catch (error: any) {
            throw new Error(`Swap execution failed: ${error.message || error}`);
        }
    }

    /**
     * Create a quote request for ETH to token swap
     */
    static createETHToTokenQuoteRequest(
        ethAmount: string,
        tokenAddress: string,
        senderAddress: string,
        slippage: number = 0.5
    ): BungeeQuoteRequest {
        // Native ETH address in Bungee convention
        const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        
        return {
            fromChainId: 8453, // Base Mainnet
            fromTokenAddress: ETH_ADDRESS,
            fromAmount: ethers.parseEther(ethAmount).toString(),
            toChainId: 8453,
            toTokenAddress: tokenAddress,
            senderAddress: senderAddress,
            recipientAddress: senderAddress,
            slippage: slippage
        };
    }

    /**
     * Swap ETH to a custom token on Base
     */
    async swapETHToToken(
        wallet: ethers.Wallet,
        tokenAddress: string,
        ethAmount: string,
        slippage: number = 0.5
    ): Promise<{
        txHash: string;
        receipt: ethers.TransactionReceipt;
        estimatedOutput: string;
    }> {
        const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const amountInWei = ethers.parseEther(ethAmount).toString();

        return await this.executeSwap(
            wallet,
            ETH_ADDRESS,
            tokenAddress,
            amountInWei,
            slippage
        );
    }

    /**
     * Get supported chains
     */
    async getSupportedChains(): Promise<any> {
        try {
            const response = await axios.get(`${BungeeService.API_BASE_URL}/chains`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get supported chains: ${error}`);
        }
    }

    /**
     * Check if Bungee API is available
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${BungeeService.API_BASE_URL}/health`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}
