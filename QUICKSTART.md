# ⚡ Quick Start Guide

Get up and running with Mass Token Buy Bot in 5 minutes!

## 🚀 Installation (One-Time Setup)

```bash
# 1. Navigate to project directory
cd mass-token-buy-web

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Start development server
npm run serve
```

Open http://localhost:8080 in your browser.

## 🔐 First-Time Setup

### Step 1: Set Master Password
1. Open the application
2. Enter a strong password (minimum 8 characters)
3. Click "Unlock Application"

**⚠️ IMPORTANT:** Remember this password! It encrypts all wallet data and cannot be recovered.

### Step 2: Configure Parameters

Fill in the configuration form:

| Field | Example | Description |
|-------|---------|-------------|
| Token Address | `0x9e12735d77c72c5C3670636D428f2F3815d8A4cB` | The token you want to buy |
| Number of Wallets | `10` | How many wallets to create |
| Master Private Key | `0x...` | Your funding wallet's private key |
| Target Address | `0x...` | Where to send purchased tokens |
| Gas Amount | `0.0001` | ETH reserved for gas per wallet |
| Purchase Amount | `0.001` | ETH to swap for tokens per wallet |
| Min Kept Tokens | `100` | Minimum tokens to keep in wallets |
| RPC URL | `https://mainnet.base.org` | Base network RPC endpoint |

### Step 3: Calculate Required ETH

**Formula:**
```
Total ETH = (Gas Amount + Purchase Amount) × Number of Wallets
```

**Example (10 wallets):**
```
Total = (0.0001 + 0.001) × 10 = 0.011 ETH
```

**Plus:** Extra ETH in master wallet for transaction fees (~0.001 ETH)

**Total needed:** ~0.012 ETH in master wallet

### Step 4: Start Operation

1. Click "Start Operation"
2. Monitor progress in real-time
3. Check logs for detailed information
4. View transactions in the table

## 📊 Understanding the Interface

### Status Panel
- **Operation Status**: Current step in the process
- **Wallets Created**: Number of wallets generated
- **ETH Transferred**: Completed fund transfers
- **Swaps Completed**: Successful token swaps
- **Tokens Transferred**: Consolidations completed

### Activity Logs
- Real-time log of all operations
- Color-coded by severity (info, success, warning, error)
- Timestamps for each action
- Export to text file

### Transaction History
- Complete record of all transactions
- Links to BaseScan for verification
- Filter and search functionality
- Export to CSV

### Generated Wallets
- List of all created wallets
- Current balances (ETH and tokens)
- Status indicators
- Export with encrypted keys

## 🎯 Test Run (Recommended First)

Start with a small test:

```
Token Address: [Your token]
Number of Wallets: 3
Gas Amount: 0.0001
Purchase Amount: 0.001
Min Kept Tokens: 10

Total ETH needed: ~0.0035 ETH
```

This allows you to:
- Test the complete workflow
- Verify settings are correct
- Understand the process
- Minimize risk

## ⚠️ Before Production Use

### Checklist
- [ ] Tested with 3-5 wallets first
- [ ] Verified token address on BaseScan
- [ ] Confirmed master wallet has sufficient ETH
- [ ] Backed up master password
- [ ] Understood the operation flow
- [ ] Checked current Base gas prices
- [ ] Verified RPC endpoint is working
- [ ] Set appropriate slippage expectations

### Security Reminders
- ✅ Password is encrypted locally
- ✅ Private keys never leave your browser
- ✅ All data stored in browser only
- ❌ Never share your private keys
- ❌ Never share your master password
- ❌ Always use HTTPS

## 🔄 Operation Flow

```
1. CREATE WALLETS
   ├─ Generate N random wallets
   ├─ Encrypt private keys
   └─ Save to local database

2. FUND WALLETS
   ├─ Calculate ETH per wallet
   ├─ Transfer from master wallet
   └─ Wait for confirmations

3. SWAP TOKENS
   ├─ Get quote from Bungee
   ├─ Execute swap transaction
   └─ Wait for confirmations

4. CONSOLIDATE FUNDS
   ├─ Transfer tokens to target (minus min kept)
   ├─ Transfer remaining ETH to target
   └─ Mark wallets as completed
```

## 🛠️ Common Operations

### Save Configuration
Configuration is automatically saved when you click "Start Operation".

### Load Previous Configuration
Click "Load Saved Config" to restore your last configuration.

### Stop Operation
Click "Stop Operation" to halt the process. Already completed transactions won't be reversed.

### Export Data
- **Logs**: Click "Export Logs" in Activity Logs section
- **Transactions**: Click "Export CSV" in Transaction History
- **Wallets**: Click "Export Wallets" in Generated Wallets section

### Clear Logs
Click "Clear Logs" to remove log entries from display (doesn't affect saved data).

## 📱 Browser Compatibility

✅ **Supported Browsers:**
- Chrome/Edge (v90+)
- Firefox (v88+)
- Safari (v14+)
- Brave (latest)

❌ **Not Supported:**
- Internet Explorer
- Very old browser versions
- Browsers with disabled JavaScript

## 🐛 Quick Troubleshooting

### "Insufficient balance"
➡️ Add more ETH to master wallet

### "Transaction failed"
➡️ Increase gas amount or check token liquidity

### "Bungee API error"
➡️ Wait a moment and retry, or check network connection

### "Decryption failed"
➡️ Verify you're using the correct master password

### "Database not initialized"
➡️ Refresh the page and unlock again

## 🎓 Next Steps

After your first successful test run:

1. **Review Results**
   - Check all transactions on BaseScan
   - Verify token balances in target wallet
   - Review created wallets

2. **Scale Up**
   - Gradually increase number of wallets
   - Monitor performance
   - Adjust parameters as needed

3. **Backup Data**
   - Export wallets (encrypted)
   - Export transaction history
   - Save your configuration

4. **Production Use**
   - Use tested parameters
   - Monitor closely
   - Keep detailed records

## 📚 Learn More

- **Full Documentation**: See [README.md](README.md)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **API Details**: See [docs/API.md](docs/API.md)

## 💡 Pro Tips

1. **Always test with small amounts first**
2. **Monitor Base gas prices** before large operations
3. **Use your own RPC node** for production (more reliable)
4. **Export data regularly** as backups
5. **Keep browser tab active** during operations
6. **Check token liquidity** before large swaps
7. **Set realistic slippage** based on market conditions
8. **Monitor the first few transactions** closely

## 🆘 Getting Help

If you encounter issues:
1. Check the troubleshooting section above
2. Review the full README documentation
3. Check browser console for errors
4. Verify all configuration parameters
5. Test with smaller amounts

---

**Ready to start?** Run `npm run serve` and open http://localhost:8080! 🚀
