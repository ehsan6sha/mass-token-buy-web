// Direct DEX integration for token swaps (Uniswap V3, etc.)

import { ethers } from 'ethers';

export interface SwapConfig {
    chain: string;
    dex: string;
    fromToken: string;
    toToken: string;
    amount: string;
    slippage: number;
}

export interface SwapResult {
    txHash: string;
    receipt: ethers.TransactionReceipt;
    estimatedOutput: string;
}

// Chain configurations
export const CHAINS: Record<string, { chainId: number; name: string; nativeToken: string; wethAddress: string; rpcUrl: string }> = {
    'base': {
        chainId: 8453,
        name: 'Base',
        nativeToken: 'ETH',
        wethAddress: '0x4200000000000000000000000000000000000006',
        rpcUrl: 'https://mainnet.base.org'
    },
    'ethereum': {
        chainId: 1,
        name: 'Ethereum',
        nativeToken: 'ETH',
        wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        rpcUrl: 'https://eth.llamarpc.com'
    },
    'arbitrum': {
        chainId: 42161,
        name: 'Arbitrum',
        nativeToken: 'ETH',
        wethAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        rpcUrl: 'https://arb1.arbitrum.io/rpc'
    }
};

// DEX configurations
export const DEXES: Record<string, { name: string; routers: Record<number, string>; quoters: Record<number, string> }> = {
    'uniswap-v3': {
        name: 'Uniswap V3',
        routers: {
            8453: '0x2626664c2603336E57B271c5C0b26F421741e481',  // Base
            1: '0xE592427A0AEce92De3Edee1F18E0157C05861564',     // Ethereum
            42161: '0xE592427A0AEce92De3Edee1F18E0157C05861564'  // Arbitrum
        },
        quoters: {
            8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',  // Base
            1: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',     // Ethereum
            42161: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'  // Arbitrum
        }
    },
    'uniswap-v2': {
        name: 'Uniswap V2',
        routers: {
            8453: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',  // BaseSwap on Base
            1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',     // Ethereum
            42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'  // Sushiswap on Arbitrum
        },
        quoters: {}  // V2 doesn't use quoter, uses router directly
    }
};

export class DexService {
    private provider: ethers.JsonRpcProvider;
    private chain: string;
    private dex: string;

    constructor(chain: string = 'base', dex: string = 'uniswap-v3', rpcUrl?: string) {
        this.chain = chain;
        this.dex = dex;
        const chainConfig = CHAINS[chain];
        this.provider = new ethers.JsonRpcProvider(rpcUrl || chainConfig.rpcUrl);
    }

    /**
     * Swap ETH for tokens using Uniswap V3
     */
    async swapETHToToken(
        wallet: ethers.Wallet,
        tokenAddress: string,
        ethAmount: string,
        slippage: number = 0.5
    ): Promise<SwapResult> {
        const chainConfig = CHAINS[this.chain];
        const dexConfig = DEXES[this.dex];

        if (this.dex === 'uniswap-v3') {
            return await this.swapUniswapV3(wallet, tokenAddress, ethAmount, slippage, chainConfig, dexConfig);
        } else if (this.dex === 'uniswap-v2') {
            return await this.swapUniswapV2(wallet, tokenAddress, ethAmount, slippage, chainConfig, dexConfig);
        }

        throw new Error(`Unsupported DEX: ${this.dex}`);
    }

    /**
     * Uniswap V3 swap implementation
     */
    private async swapUniswapV3(
        wallet: ethers.Wallet,
        tokenAddress: string,
        ethAmount: string,
        slippage: number,
        chainConfig: typeof CHAINS[keyof typeof CHAINS],
        dexConfig: typeof DEXES[keyof typeof DEXES]
    ): Promise<SwapResult> {
        const routerAddress = dexConfig.routers[chainConfig.chainId];
        const quoterAddress = dexConfig.quoters[chainConfig.chainId];

        if (!routerAddress || !quoterAddress) {
            throw new Error(`${dexConfig.name} not supported on ${chainConfig.name}`);
        }

        // Uniswap V3 SwapRouter02 ABI (correct structure)
        const routerAbi = [
            'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)'
        ];

        // Quoter V2 ABI
        const quoterAbi = [
            'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
        ];

        const router = new ethers.Contract(routerAddress, routerAbi, wallet);
        const quoter = new ethers.Contract(quoterAddress, quoterAbi, this.provider);

        const amountIn = ethers.parseEther(ethAmount);
        const wethAddress = chainConfig.wethAddress;

        // Try different fee tiers (3000 = 0.3%, 500 = 0.05%, 10000 = 1%)
        const feeTiers = [3000, 500, 10000];
        let bestQuote = BigInt(0);
        let bestFee = 3000;

        for (const fee of feeTiers) {
            try {
                const params = {
                    tokenIn: wethAddress,
                    tokenOut: tokenAddress,
                    amountIn: amountIn,
                    fee: fee,
                    sqrtPriceLimitX96: 0
                };

                const result = await quoter.quoteExactInputSingle.staticCall(params);
                const amountOut = result[0]; // First element is amountOut

                if (amountOut > bestQuote) {
                    bestQuote = amountOut;
                    bestFee = fee;
                }
            } catch (error) {
                // This fee tier might not have a pool, try next
                console.log(`Fee tier ${fee} not available, trying next...`);
            }
        }

        if (bestQuote === BigInt(0)) {
            throw new Error('No liquidity pool found for this token pair');
        }

        // Calculate minimum output with slippage
        const slippageBps = Math.floor(slippage * 100); // Convert to basis points
        const amountOutMinimum = (bestQuote * BigInt(10000 - slippageBps)) / BigInt(10000);

        // Get token decimals for proper formatting
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function decimals() view returns (uint8)'],
            this.provider
        );
        const decimals = await tokenContract.decimals();

        console.log(`Best quote: ${ethers.formatUnits(bestQuote, decimals)} tokens at ${bestFee / 10000}% fee`);
        console.log(`Minimum output (${slippage}% slippage): ${ethers.formatUnits(amountOutMinimum, decimals)} tokens`);

        // Prepare swap parameters (SwapRouter02 doesn't use deadline in params)
        const swapParams = {
            tokenIn: wethAddress,
            tokenOut: tokenAddress,
            fee: bestFee,
            recipient: wallet.address,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        };

        // Prepare transaction options
        const txOptions: any = { value: amountIn };
        
        // Get current gas price and set reasonable limits for Base network
        // Base uses EIP-1559, so we need maxFeePerGas and maxPriorityFeePerGas
        try {
            const feeData = await this.provider.getFeeData();
            
            // Base network typically has very low gas (0.001-0.01 Gwei)
            // Use current network fee or minimum of 0.02 Gwei (network may reject lower)
            const minAcceptableFee = ethers.parseUnits('0.02', 'gwei');
            const maxAllowedFee = ethers.parseUnits('0.1', 'gwei');
            
            // Use network fee but ensure it's at least the minimum and not more than max
            const currentMaxFee = feeData.maxFeePerGas || minAcceptableFee;
            const currentPriorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.001', 'gwei');
            
            // Clamp between min and max
            if (currentMaxFee < minAcceptableFee) {
                txOptions.maxFeePerGas = minAcceptableFee;
            } else if (currentMaxFee > maxAllowedFee) {
                txOptions.maxFeePerGas = maxAllowedFee;
            } else {
                txOptions.maxFeePerGas = currentMaxFee;
            }
            
            txOptions.maxPriorityFeePerGas = currentPriorityFee < maxAllowedFee ? currentPriorityFee : ethers.parseUnits('0.001', 'gwei');
            
            console.log(`Using maxFeePerGas: ${ethers.formatUnits(txOptions.maxFeePerGas, 'gwei')} Gwei`);
            console.log(`Using maxPriorityFeePerGas: ${ethers.formatUnits(txOptions.maxPriorityFeePerGas, 'gwei')} Gwei`);
        } catch (error) {
            console.warn('Failed to get gas price, using default');
            txOptions.maxFeePerGas = ethers.parseUnits('0.01', 'gwei');
            txOptions.maxPriorityFeePerGas = ethers.parseUnits('0.001', 'gwei');
        }
        
        // Try to estimate gas, use provided gasLimit as fallback
        try {
            const estimatedGas = await router.exactInputSingle.estimateGas(swapParams, { 
                value: amountIn, 
                maxFeePerGas: txOptions.maxFeePerGas,
                maxPriorityFeePerGas: txOptions.maxPriorityFeePerGas
            });
            txOptions.gasLimit = estimatedGas * BigInt(120) / BigInt(100); // Add 20% buffer
            console.log(`Estimated gas limit: ${estimatedGas.toString()}`);
        } catch (gasError) {
            console.warn('Gas estimation failed, using fallback gas limit');
            txOptions.gasLimit = 300000; // Safe default for Uniswap V3 swaps
            console.log(`Using fallback gas limit: ${txOptions.gasLimit}`);
        }

        console.log(`Max total gas cost: ${ethers.formatEther(txOptions.maxFeePerGas * BigInt(txOptions.gasLimit))} ETH`);

        // Execute swap
        console.log('Submitting swap transaction...');
        const tx = await router.exactInputSingle(swapParams, txOptions);
        console.log(`Transaction submitted: ${tx.hash}`);
        
        // Wait for confirmation with timeout
        console.log('Waiting for confirmation...');
        const receipt = await Promise.race([
            tx.wait(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Transaction confirmation timeout (60s). Gas price may be too low.')), 60000)
            )
        ]) as ethers.TransactionReceipt;

        if (!receipt || receipt.status !== 1) {
            throw new Error('Swap transaction failed');
        }
        
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        return {
            txHash: receipt.hash,
            receipt: receipt,
            estimatedOutput: ethers.formatUnits(bestQuote, decimals)
        };
    }

    /**
     * Uniswap V2 swap implementation
     */
    private async swapUniswapV2(
        wallet: ethers.Wallet,
        tokenAddress: string,
        ethAmount: string,
        slippage: number,
        chainConfig: typeof CHAINS[keyof typeof CHAINS],
        dexConfig: typeof DEXES[keyof typeof DEXES]
    ): Promise<SwapResult> {
        const routerAddress = dexConfig.routers[chainConfig.chainId];

        if (!routerAddress) {
            throw new Error(`${dexConfig.name} not supported on ${chainConfig.name}`);
        }

        // Uniswap V2 Router ABI (minimal)
        const routerAbi = [
            'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
            'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
        ];

        const router = new ethers.Contract(routerAddress, routerAbi, wallet);
        const amountIn = ethers.parseEther(ethAmount);
        const wethAddress = chainConfig.wethAddress;

        // Create path: WETH -> Token
        const path = [wethAddress, tokenAddress];

        // Get quote
        const amounts = await router.getAmountsOut(amountIn, path);
        const expectedOutput = amounts[1];

        // Calculate minimum output with slippage
        const slippageBps = Math.floor(slippage * 100);
        const amountOutMin = (expectedOutput * BigInt(10000 - slippageBps)) / BigInt(10000);

        // Get token decimals
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function decimals() view returns (uint8)'],
            this.provider
        );
        const decimals = await tokenContract.decimals();

        console.log(`Expected output: ${ethers.formatUnits(expectedOutput, decimals)} tokens`);
        console.log(`Minimum output (${slippage}% slippage): ${ethers.formatUnits(amountOutMin, decimals)} tokens`);

        // Prepare transaction options
        const txOptions: any = { value: amountIn };
        
        // Get current gas price and set reasonable limits (EIP-1559)
        try {
            const feeData = await this.provider.getFeeData();
            const minAcceptableFee = ethers.parseUnits('0.02', 'gwei');
            const maxAllowedFee = ethers.parseUnits('0.1', 'gwei');
            
            const currentMaxFee = feeData.maxFeePerGas || minAcceptableFee;
            const currentPriorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.001', 'gwei');
            
            // Clamp between min and max
            if (currentMaxFee < minAcceptableFee) {
                txOptions.maxFeePerGas = minAcceptableFee;
            } else if (currentMaxFee > maxAllowedFee) {
                txOptions.maxFeePerGas = maxAllowedFee;
            } else {
                txOptions.maxFeePerGas = currentMaxFee;
            }
            
            txOptions.maxPriorityFeePerGas = currentPriorityFee < maxAllowedFee ? currentPriorityFee : ethers.parseUnits('0.001', 'gwei');
            
            console.log(`Using maxFeePerGas: ${ethers.formatUnits(txOptions.maxFeePerGas, 'gwei')} Gwei`);
        } catch (error) {
            txOptions.maxFeePerGas = ethers.parseUnits('0.02', 'gwei');
            txOptions.maxPriorityFeePerGas = ethers.parseUnits('0.001', 'gwei');
        }
        
        // Try to estimate gas, use fallback if it fails
        try {
            const estimatedGas = await router.swapExactETHForTokens.estimateGas(
                amountOutMin,
                path,
                wallet.address,
                Math.floor(Date.now() / 1000) + 60 * 20,
                { 
                    value: amountIn, 
                    maxFeePerGas: txOptions.maxFeePerGas,
                    maxPriorityFeePerGas: txOptions.maxPriorityFeePerGas
                }
            );
            txOptions.gasLimit = estimatedGas * BigInt(120) / BigInt(100); // Add 20% buffer
            console.log(`Estimated gas limit: ${estimatedGas.toString()}`);
        } catch (gasError) {
            console.warn('Gas estimation failed, using fallback gas limit');
            txOptions.gasLimit = 250000; // Safe default for V2 swaps
            console.log(`Using fallback gas limit: ${txOptions.gasLimit}`);
        }

        console.log(`Max total gas cost: ${ethers.formatEther(txOptions.maxFeePerGas * BigInt(txOptions.gasLimit))} ETH`);

        // Execute swap
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        const tx = await router.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            txOptions
        );

        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
            throw new Error('Swap transaction failed');
        }

        return {
            txHash: receipt.hash,
            receipt: receipt,
            estimatedOutput: ethers.formatUnits(expectedOutput, decimals)
        };
    }

    /**
     * Update chain and DEX
     */
    updateConfig(chain: string, dex: string, rpcUrl?: string): void {
        this.chain = chain;
        this.dex = dex;
        const chainConfig = CHAINS[chain];
        this.provider = new ethers.JsonRpcProvider(rpcUrl || chainConfig.rpcUrl);
    }
}
