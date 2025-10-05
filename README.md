# 🚀 Mass Token Buy Bot - Base Network

A production-ready, secure web application for automated token purchasing on the Base network. This bot creates multiple wallets, distributes ETH, swaps for tokens using Bungee.exchange, and consolidates funds - all from your browser.

## ✨ Features

- 🔐 **Secure & Encrypted**: All private keys are encrypted using AES-GCM with password protection
- 💾 **Local Storage**: Uses IndexedDB for persistent, local-only data storage (no server required)
- 🌐 **GitHub Pages Compatible**: Runs entirely in the browser - perfect for static hosting
- 📊 **Real-time Tracking**: Monitor all transactions with detailed logs and status updates
- 🔄 **Bungee Integration**: Utilizes Bungee.exchange API for optimal token swaps
- 📈 **Batch Operations**: Create and manage up to 1000 wallets simultaneously
- 🎨 **Modern UI**: Clean, responsive interface with dark theme
- ⚡ **TypeScript**: Type-safe, production-level code

## 🏗️ Architecture

```
mass-token-buy-web/
├── src/
│   ├── app.ts              # Main application logic
│   ├── types.ts            # TypeScript type definitions
│   ├── database.ts         # IndexedDB wrapper
│   ├── crypto.ts           # Encryption utilities (Web Crypto API)
│   ├── wallet.ts           # Wallet management (ethers.js)
│   ├── bungee.ts           # Bungee.exchange API integration
│   ├── transactions.ts     # Transaction orchestration
│   └── ui.ts              # UI management
├── index.html             # Main HTML file
├── styles.css             # Styling
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
├── webpack.config.js      # Build configuration
└── README.md             # This file
```

## 🛠️ Technology Stack

- **TypeScript**: Type-safe development
- **Ethers.js v6**: Ethereum wallet and transaction handling
- **Axios**: HTTP client for Bungee API
- **IndexedDB**: Browser-based local database
- **Web Crypto API**: Secure encryption/decryption
- **Webpack**: Module bundling for browser
- **Base Network**: Layer 2 Ethereum blockchain

## 📋 Prerequisites

- Node.js v18 or higher
- npm or yarn
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Master wallet with sufficient ETH on Base network

## 🚀 Installation

1. **Clone or download the repository**
   ```bash
   cd mass-token-buy-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run development server (optional)**
   ```bash
   npm run serve
   ```

5. **Deploy to GitHub Pages**
   - Build the project
   - Upload the `dist` folder to GitHub Pages
   - Or use GitHub Actions for automated deployment

## 📦 Deployment to GitHub Pages

### Method 1: Manual Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Push the `dist` folder to the `gh-pages` branch:
   ```bash
   git add dist -f
   git commit -m "Deploy to GitHub Pages"
   git subtree push --prefix dist origin gh-pages
   ```

### Method 2: GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build
        run: npm run build
        
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Then enable GitHub Pages in your repository settings to serve from the `gh-pages` branch.

## 📖 Usage Guide

### Initial Setup

1. **Open the application** in your browser
2. **Set a master password** (minimum 8 characters)
   - This password encrypts all wallet private keys
   - **IMPORTANT**: Remember this password - it cannot be recovered!
3. Click "Unlock Application"

### Configuration Parameters

Fill in the following required fields:

1. **Token Address**: The ERC-20 token contract address on Base (e.g., `0x9e12735d77c72c5C3670636D428f2F3815d8A4cB`)
2. **Number of Wallets**: How many wallets to create (1-1000)
3. **Master Wallet Private Key**: Private key of the wallet funding the operation
   - Must have sufficient ETH to fund all wallets
4. **Target Wallet Address**: Where remaining funds will be sent after swaps
5. **Gas Fee Amount (ETH)**: Amount reserved for gas per wallet (e.g., `0.0001`)
6. **Purchase Amount (ETH)**: Amount to swap for tokens per wallet (e.g., `0.001`)
7. **Minimum Kept Tokens**: Minimum tokens to keep in each wallet after transfer
8. **Base RPC URL**: Base network RPC endpoint (default: `https://mainnet.base.org`)

### Operation Flow

1. **Wallet Creation**: Creates N new wallets with encrypted private keys
2. **Fund Distribution**: Transfers ETH from master wallet to each new wallet
3. **Token Swaps**: Swaps ETH for target token using Bungee.exchange in each wallet
4. **Fund Consolidation**: Transfers tokens and remaining ETH to target address
   - Keeps minimum specified tokens in each wallet
   - Transfers all remaining ETH

### Monitoring

- **Status Panel**: Real-time operation progress
- **Activity Logs**: Detailed logs of all actions
- **Transaction History**: Complete record with BaseScan links
- **Wallets Table**: List of all created wallets with balances

### Data Management

- **Save Config**: All parameters are automatically saved to local storage
- **Load Config**: Restore previously saved configuration
- **Export Logs**: Download activity logs as text file
- **Export Transactions**: Download transaction history as CSV
- **Export Wallets**: Download wallet list with encrypted keys (CSV)

## 🔒 Security Features

### Encryption

- **AES-GCM 256-bit encryption** for all private keys
- **PBKDF2** key derivation with 100,000 iterations
- **Random salt and IV** for each encryption operation
- **Password hashing** using SHA-256

### Data Storage

- All data stored **locally** in IndexedDB
- No data sent to external servers (except blockchain RPCs)
- Private keys **never** leave your browser unencrypted
- Password is **never** stored (only hash for verification)

### Best Practices

1. **Use a strong master password** (12+ characters, mixed case, numbers, symbols)
2. **Backup your data** regularly (export wallets and transactions)
3. **Test with small amounts** first
4. **Keep your master wallet secure**
5. **Use secure RPC endpoints** (avoid public nodes for production)
6. **Clear browser data** only if you have backups

## ⚙️ Configuration Examples

### Small Test Run

```
Token Address: 0x9e12735d77c72c5C3670636D428f2F3815d8A4cB
Number of Wallets: 5
Gas Amount: 0.0001 ETH
Purchase Amount: 0.001 ETH
Min Kept Tokens: 100
```

**Total ETH needed**: 0.0055 ETH (plus extra for master wallet gas)

### Production Run

```
Token Address: 0x9e12735d77c72c5C3670636D428f2F3815d8A4cB
Number of Wallets: 500
Gas Amount: 0.0002 ETH
Purchase Amount: 0.005 ETH
Min Kept Tokens: 1000
```

**Total ETH needed**: 2.6 ETH (plus extra for master wallet gas)

## 🔧 Development

### Build Commands

```bash
# Development mode with watch
npm run dev

# Production build
npm run build

# Run development server
npm run serve

# Type checking only
npm run type-check
```

### Project Structure

- **src/types.ts**: Shared TypeScript interfaces
- **src/database.ts**: IndexedDB operations
- **src/crypto.ts**: Encryption/decryption using Web Crypto API
- **src/wallet.ts**: Wallet creation and transactions
- **src/bungee.ts**: Bungee.exchange API integration
- **src/transactions.ts**: Main operation orchestration
- **src/ui.ts**: UI updates and event handling
- **src/app.ts**: Application initialization and coordination

## 🌐 Bungee.exchange API

This bot uses the Bungee.exchange API for token swaps:

- **Endpoint**: `https://api.bungee.exchange/v1/quote`
- **Chain ID**: 8453 (Base Mainnet)
- **Native ETH Address**: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
- **Slippage**: Default 0.5%

The API returns optimal routing across multiple DEXs on Base for the best swap rates.

## ⚠️ Important Notes

### Gas Estimation

The bot uses the **exact** gas and token amounts you specify. Ensure you provide:
- Sufficient gas amount for transactions on Base
- Appropriate slippage for token swaps
- Extra ETH in master wallet for gas fees

### Rate Limits

- Bungee API may have rate limits
- Add delays between operations to avoid issues
- Current delays: 100ms (wallet creation), 500ms (transfers), 1000ms (swaps)

### Error Handling

- All operations have try-catch error handling
- Failed transactions are logged with details
- Operation can be stopped at any time
- Failed wallets remain in "created" or "funded" state for retry

### Network Considerations

- Base network uses EIP-1559 (priority fees)
- Gas prices are fetched dynamically
- Transactions wait for 1 confirmation by default
- Failed transactions don't halt the entire operation

## 🐛 Troubleshooting

### "Failed to open database"
- Clear browser cache/storage
- Try a different browser
- Check browser's IndexedDB support

### "Insufficient balance"
- Ensure master wallet has enough ETH
- Account for gas costs in calculations
- Check Base network balance, not mainnet

### "Transaction failed or was reverted"
- Check gas amount is sufficient
- Verify token address is correct
- Ensure sufficient liquidity for swap
- Try increasing slippage tolerance

### "Bungee API error"
- Check internet connection
- Verify Base RPC is accessible
- Wait and retry (may be rate limited)
- Check Bungee service status

### "Decryption failed"
- Wrong master password
- Clear data and start fresh
- Check for browser updates

## 📊 Performance

- **Wallet Creation**: ~100ms per wallet
- **ETH Transfer**: ~500ms per transaction
- **Token Swap**: ~1-3 seconds per swap (network dependent)
- **Token Transfer**: ~500ms per transaction

For 100 wallets, expect total runtime of approximately **10-15 minutes**.

## 🤝 Contributing

This is a production tool. If you'd like to contribute:

1. Test thoroughly on testnet first
2. Maintain security standards
3. Add proper error handling
4. Update documentation
5. Follow TypeScript best practices

## 📄 License

MIT License - Use at your own risk

## ⚡ Support

For issues and questions:
1. Check this README thoroughly
2. Review browser console for errors
3. Test with small amounts first
4. Verify all configuration parameters

## 🎯 Roadmap

Potential future enhancements:
- [ ] Multi-chain support
- [ ] Custom DEX selection
- [ ] Advanced slippage controls
- [ ] Batch retry for failed operations
- [ ] Import/export encrypted config
- [ ] Transaction cost estimation
- [ ] Mobile-responsive improvements
- [ ] Multi-language support

---

**⚠️ DISCLAIMER**: This software is for educational and personal use. Trading cryptocurrencies carries risk. Always test with small amounts first. The authors are not responsible for any losses incurred through the use of this software. Use at your own risk.

**🔐 SECURITY WARNING**: Never share your private keys or master password. Always verify smart contract addresses before interacting. This tool handles sensitive cryptographic material - use responsibly.
