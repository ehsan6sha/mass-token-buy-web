# API Documentation

This document describes the internal APIs and external API integrations used in the Mass Token Buy Bot.

## 📚 Table of Contents

- [Internal APIs](#internal-apis)
- [External APIs](#external-apis)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)

## Internal APIs

### Database API

#### `Database.init()`
Initializes the IndexedDB database.

```typescript
await database.init(): Promise<void>
```

#### `Database.saveWallet(wallet)`
Saves a wallet to the database.

```typescript
await database.saveWallet(wallet: WalletInfo): Promise<number>
```

**Parameters:**
- `wallet`: WalletInfo object

**Returns:** Database ID of the saved wallet

#### `Database.getAllWallets()`
Retrieves all wallets from the database.

```typescript
await database.getAllWallets(): Promise<WalletInfo[]>
```

#### `Database.saveTransaction(transaction)`
Saves a transaction record.

```typescript
await database.saveTransaction(tx: Transaction): Promise<number>
```

#### `Database.getAllTransactions()`
Retrieves all transactions.

```typescript
await database.getAllTransactions(): Promise<Transaction[]>
```

#### `Database.saveConfig(config)`
Saves application configuration.

```typescript
await database.saveConfig(config: AppConfig): Promise<void>
```

#### `Database.getConfig()`
Retrieves saved configuration.

```typescript
await database.getConfig(): Promise<AppConfig | null>
```

---

### Crypto API

#### `CryptoService.encrypt(data, password)`
Encrypts data using AES-GCM.

```typescript
static async encrypt(data: string, password: string): Promise<string>
```

**Parameters:**
- `data`: String to encrypt
- `password`: Encryption password

**Returns:** Base64-encoded encrypted data

**Algorithm:**
- Encryption: AES-GCM-256
- KDF: PBKDF2 (100,000 iterations)
- Hash: SHA-256

#### `CryptoService.decrypt(encryptedData, password)`
Decrypts AES-GCM encrypted data.

```typescript
static async decrypt(encryptedData: string, password: string): Promise<string>
```

**Parameters:**
- `encryptedData`: Base64-encoded encrypted string
- `password`: Decryption password

**Returns:** Decrypted string

**Throws:** Error if password is incorrect or data is corrupted

#### `CryptoService.hashPassword(password)`
Hashes a password using SHA-256.

```typescript
static async hashPassword(password: string): Promise<string>
```

---

### Wallet API

#### `WalletService.createWallet(password)`
Creates a new random wallet.

```typescript
async createWallet(password: string): Promise<{
  wallet: ethers.Wallet;
  info: WalletInfo;
}>
```

#### `WalletService.loadWallet(encryptedPrivateKey, password)`
Loads a wallet from encrypted private key.

```typescript
async loadWallet(
  encryptedPrivateKey: string,
  password: string
): Promise<ethers.Wallet>
```

#### `WalletService.getBalance(address)`
Gets ETH balance of an address.

```typescript
async getBalance(address: string): Promise<string>
```

**Returns:** Balance in ETH (formatted)

#### `WalletService.getTokenBalance(tokenAddress, walletAddress)`
Gets ERC-20 token balance.

```typescript
async getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<string>
```

**Returns:** Token balance (formatted with decimals)

#### `WalletService.transferETH(fromWallet, toAddress, amount)`
Transfers ETH between wallets.

```typescript
async transferETH(
  fromWallet: ethers.Wallet,
  toAddress: string,
  amount: string
): Promise<ethers.TransactionReceipt>
```

**Parameters:**
- `fromWallet`: Sender wallet
- `toAddress`: Recipient address
- `amount`: Amount in ETH (as string)

#### `WalletService.transferToken(fromWallet, tokenAddress, toAddress, amount)`
Transfers ERC-20 tokens.

```typescript
async transferToken(
  fromWallet: ethers.Wallet,
  tokenAddress: string,
  toAddress: string,
  amount: string
): Promise<ethers.TransactionReceipt>
```

---

### Bungee API

#### `BungeeService.getQuote(request)`
Gets a swap quote from Bungee.

```typescript
async getQuote(request: BungeeQuoteRequest): Promise<BungeeQuoteResponse>
```

**Request Structure:**
```typescript
{
  fromChainId: 8453,        // Base Mainnet
  fromTokenAddress: string, // Token address or ETH address
  fromAmount: string,       // Amount in wei
  toChainId: 8453,
  toTokenAddress: string,
  senderAddress: string,
  recipientAddress: string,
  slippage: number          // e.g., 0.5 for 0.5%
}
```

**Response Structure:**
```typescript
{
  tx: {
    to: string,
    data: string,
    value: string,
    gasLimit: string
  },
  toAmount: string,
  toToken: {
    symbol: string,
    decimals: number
  },
  approvalData?: {...}
}
```

#### `BungeeService.swapETHToToken(wallet, tokenAddress, ethAmount, slippage)`
Executes an ETH to token swap.

```typescript
async swapETHToToken(
  wallet: ethers.Wallet,
  tokenAddress: string,
  ethAmount: string,
  slippage?: number
): Promise<{
  txHash: string;
  receipt: ethers.TransactionReceipt;
  estimatedOutput: string;
}>
```

---

### Transaction Manager API

#### `TransactionManager.executeOperation(config, password)`
Executes the complete token buying operation.

```typescript
async executeOperation(
  config: AppConfig,
  password: string
): Promise<void>
```

**Workflow:**
1. Validates configuration
2. Loads master wallet
3. Creates N new wallets
4. Funds wallets with ETH
5. Swaps ETH for tokens in each wallet
6. Transfers tokens and remaining ETH to target

#### `TransactionManager.stopOperation()`
Stops the current operation.

```typescript
stopOperation(): void
```

---

## External APIs

### Bungee.exchange API

**Base URL:** `https://api.bungee.exchange`

#### Quote Endpoint

**POST** `/v1/quote`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "optional-api-key"
}
```

**Request Body:**
```json
{
  "fromChainId": 8453,
  "fromTokenAddress": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "fromAmount": "1000000000000000000",
  "toChainId": 8453,
  "toTokenAddress": "0x...",
  "senderAddress": "0x...",
  "recipientAddress": "0x...",
  "slippage": 0.5
}
```

**Response:**
```json
{
  "tx": {
    "to": "0x...",
    "data": "0x...",
    "value": "1000000000000000000",
    "gasLimit": "500000"
  },
  "toAmount": "1000000000000000000000",
  "toToken": {
    "symbol": "TOKEN",
    "decimals": 18
  },
  "route": {...},
  "gasFees": {...}
}
```

**Error Codes:**
- `400`: Invalid request parameters
- `429`: Rate limit exceeded
- `500`: Internal server error

---

### Base Network RPC

**Default Endpoint:** `https://mainnet.base.org`

**Alternative Endpoints:**
- Alchemy: `https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
- QuickNode: Various endpoints
- Tenderly: `https://base.gateway.tenderly.co`

**Standard JSON-RPC Methods Used:**
- `eth_getBalance`: Get ETH balance
- `eth_call`: Call contract methods
- `eth_estimateGas`: Estimate gas for transactions
- `eth_sendRawTransaction`: Send signed transactions
- `eth_getTransactionReceipt`: Get transaction receipt
- `eth_gasPrice`: Get current gas price
- `eth_feeHistory`: Get fee history (EIP-1559)

---

## Type Definitions

### AppConfig
```typescript
interface AppConfig {
  tokenAddress: string;
  numWallets: number;
  masterPrivateKey: string;
  targetAddress: string;
  gasAmount: string;
  purchaseAmount: string;
  minKeptTokens: string;
  rpcUrl: string;
}
```

### WalletInfo
```typescript
interface WalletInfo {
  id: number;
  address: string;
  encryptedPrivateKey: string;
  createdAt: Date;
  ethBalance?: string;
  tokenBalance?: string;
  status: 'created' | 'funded' | 'swapped' | 'transferred' | 'completed';
}
```

### Transaction
```typescript
interface Transaction {
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
```

### OperationStatus
```typescript
interface OperationStatus {
  isRunning: boolean;
  walletsCreated: number;
  ethTransferred: number;
  swapsCompleted: number;
  tokensTransferred: number;
  currentStep: string;
  progress: number;
}
```

---

## Error Handling

### Common Error Types

#### Database Errors
```typescript
try {
  await database.init();
} catch (error) {
  // Error: "Failed to open database"
}
```

#### Encryption Errors
```typescript
try {
  await CryptoService.decrypt(data, password);
} catch (error) {
  // Error: "Decryption failed: ..."
}
```

#### Transaction Errors
```typescript
try {
  await wallet.sendTransaction(tx);
} catch (error) {
  // Error: "Failed to transfer ETH: ..."
  // Error: "Transaction failed or was reverted"
}
```

#### API Errors
```typescript
try {
  await bungee.getQuote(request);
} catch (error) {
  // Error: "Bungee API error: ..."
  // Error: "Invalid response from Bungee API"
}
```

### Error Response Format

All errors follow this pattern:
```typescript
{
  message: string;
  code?: string;
  data?: any;
}
```

---

## Rate Limits

### Bungee API
- No official rate limit published
- Recommended: 1 request per second
- Use API key for higher limits

### RPC Endpoints
- Public endpoints: ~10 requests/second
- Alchemy/Infura: Based on plan
- Consider using your own node for production

---

## Best Practices

1. **Always validate inputs** before API calls
2. **Handle errors gracefully** with try-catch
3. **Use appropriate delays** between operations
4. **Log all transactions** for debugging
5. **Monitor gas prices** before sending transactions
6. **Verify contract addresses** before interactions
7. **Test with small amounts** first
8. **Keep API keys secure** (not applicable for browser-only app)

---

For more information, see the [README](../README.md) and [source code](../src/).
