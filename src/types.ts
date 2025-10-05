// Type definitions for the application

export interface AppConfig {
    tokenAddress: string;
    numWallets: number;
    masterPrivateKey: string;
    targetAddress: string;
    gasAmount: string;
    purchaseAmount: string;
    minKeptTokens: string;
    chain: string;
    dex: string;
    rpcUrl: string;
}

export interface WalletInfo {
    id?: number;
    address: string;
    encryptedPrivateKey: string;
    createdAt: Date;
    ethBalance?: string;
    tokenBalance?: string;
    status: 'created' | 'funded' | 'swapped' | 'transferred' | 'completed';
}

export interface Transaction {
    id?: number;
    timestamp: Date;
    type: 'fund_transfer' | 'token_swap' | 'token_transfer' | 'eth_transfer';
    fromAddress: string;
    toAddress: string;
    amount: string;
    token?: string;
    txHash?: string;
    status: 'pending' | 'success' | 'failed';
    error?: string;
    gasUsed?: string;
}

export interface OperationStatus {
    isRunning: boolean;
    walletsCreated: number;
    ethTransferred: number;
    swapsCompleted: number;
    tokensTransferred: number;
    currentStep: string;
    progress: number;
}

export interface BungeeQuoteRequest {
    fromChainId: number;
    fromTokenAddress: string;
    fromAmount: string;
    toChainId: number;
    toTokenAddress: string;
    senderAddress: string;
    recipientAddress: string;
    slippage: number;
}

export interface BungeeQuoteResponse {
    tx: {
        to: string;
        data: string;
        value: string;
        gasLimit: string;
    };
    toAmount: string;
    toToken: {
        symbol: string;
        decimals: number;
    };
    approvalData?: {
        to: string;
        data: string;
        gasLimit: string;
    };
    gasFees?: {
        gasPrice: string;
        gasLimit: string;
    };
}

export interface LogEntry {
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    data?: any;
}
