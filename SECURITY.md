# Security Policy

## 🔒 Security Features

This application implements several security measures to protect your sensitive data:

### Encryption

- **AES-GCM 256-bit encryption** for all private keys stored locally
- **PBKDF2 key derivation** with 100,000 iterations and SHA-256
- **Random salt and IV** generation for each encryption operation
- **Password-based encryption** - your master password never leaves the browser

### Data Storage

- **Local-only storage** using IndexedDB
- **No server communication** except to blockchain RPC nodes and Bungee API
- **Browser-based security** - data isolated per origin
- **No external analytics or tracking**

### Best Practices

1. **Strong Passwords**: Use a password with at least 12 characters, including:
   - Uppercase and lowercase letters
   - Numbers
   - Special characters

2. **Password Management**: 
   - Your password cannot be recovered if lost
   - Store it securely (password manager recommended)
   - Never share your password

3. **Private Key Security**:
   - Private keys are encrypted before storage
   - Never expose your master wallet private key
   - Export wallet data only to secure locations

4. **RPC Endpoints**:
   - Use trusted RPC providers
   - Consider using your own node for production
   - Avoid public RPC nodes for large operations

## ⚠️ Security Considerations

### Browser Security

- **Keep your browser updated** to the latest version
- **Use HTTPS only** when accessing the application
- **Avoid public computers** for sensitive operations
- **Clear browser data carefully** - you may lose encrypted keys

### Network Security

- **Use secure networks** - avoid public WiFi for production use
- **VPN recommended** for additional privacy
- **Verify SSL certificates** when accessing the application

### Operational Security

1. **Test first**: Always test with small amounts on testnet or minimal funds
2. **Backup regularly**: Export your wallets and transaction data
3. **Verify addresses**: Double-check all addresses before operations
4. **Monitor transactions**: Keep track of all transaction hashes
5. **Secure your environment**: 
   - Use antivirus software
   - Keep OS updated
   - Avoid untrusted browser extensions

## 🚨 Vulnerabilities

### Reporting Security Issues

If you discover a security vulnerability, please:

1. **DO NOT** open a public GitHub issue
2. **DO NOT** disclose publicly until patched
3. Contact via private channels
4. Provide detailed information about the vulnerability
5. Allow time for a fix before public disclosure

### Known Limitations

1. **Browser Storage**: Data is only as secure as your browser's security
2. **Client-Side Only**: No server-side validation or backup
3. **RPC Trust**: You must trust the RPC endpoint you use
4. **API Dependency**: Reliant on Bungee.exchange API availability

## 🛡️ Security Checklist

Before using this application in production:

- [ ] Set a strong master password (12+ characters)
- [ ] Store password in a secure password manager
- [ ] Test with small amounts first
- [ ] Verify all smart contract addresses
- [ ] Use a trusted RPC endpoint
- [ ] Backup your wallet export data
- [ ] Understand the risks of automated trading
- [ ] Review all transaction parameters
- [ ] Keep browser and OS updated
- [ ] Use antivirus/anti-malware software

## 🔐 Encryption Details

### Algorithm Specifications

```
Encryption: AES-GCM
Key Length: 256 bits
IV Length: 12 bytes (96 bits)
Salt Length: 16 bytes (128 bits)
KDF: PBKDF2
KDF Iterations: 100,000
Hash Function: SHA-256
```

### Data Flow

1. User enters master password
2. Password is hashed (SHA-256) for verification
3. For encryption: Password → PBKDF2 → AES Key
4. Private keys encrypted with AES-GCM
5. Encrypted data stored in IndexedDB
6. For decryption: Retrieve → Derive Key → Decrypt

## ⚡ Smart Contract Security

When interacting with token contracts:

1. **Verify contract addresses** on BaseScan
2. **Check contract is verified** on block explorer
3. **Review token permissions** and allowances
4. **Understand swap mechanics** before executing
5. **Monitor for reentrancy** and other attack vectors

## 🔍 Auditing

This application has **not been formally audited**. Use at your own risk.

Recommended security practices:

- Review all source code before use
- Test thoroughly in development environment
- Start with minimal amounts
- Gradually scale up after confidence
- Keep detailed records of all operations

## 📋 Disclaimer

**IMPORTANT**: 

- This software is provided "AS IS" without warranty
- No guarantee of security or fitness for purpose
- Users are responsible for their own security
- Always follow security best practices
- Cryptocurrency transactions are irreversible
- Private key loss means permanent loss of funds

**USE AT YOUR OWN RISK**

## 📚 Additional Resources

- [Web Crypto API Security](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Ethereum Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Base Network Documentation](https://docs.base.org/)

---

Last Updated: 2025-10-05
