# Contributing to Mass Token Buy Bot

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### Reporting Issues

Before creating an issue:
1. Check if the issue already exists
2. Use the issue search to find similar problems
3. Collect relevant information (browser, OS, error messages)

When creating an issue:
- Use a clear, descriptive title
- Provide step-by-step reproduction instructions
- Include error messages and console logs
- Specify your environment (browser, version, OS)
- Add screenshots if relevant

### Suggesting Enhancements

Enhancement suggestions are welcome! Please:
1. Check if the feature has been suggested before
2. Provide a clear use case
3. Explain the expected behavior
4. Consider implementation challenges
5. Discuss potential security implications

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/mass-token-buy-web.git
   cd mass-token-buy-web
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the coding standards
   - Add tests if applicable
   - Update documentation
   - Ensure security best practices

4. **Test thoroughly**
   ```bash
   npm run type-check
   npm run build
   npm run serve
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: Brief description of changes"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Provide a clear description
   - Reference related issues
   - Explain the changes made
   - Include testing steps

## 📝 Coding Standards

### TypeScript

- Use strict TypeScript settings
- Define proper types for all functions
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes
- Document complex logic with comments

Example:
```typescript
/**
 * Encrypts data using AES-GCM
 * @param data - The data to encrypt
 * @param password - The encryption password
 * @returns Encrypted data as base64 string
 */
async function encrypt(data: string, password: string): Promise<string> {
  // Implementation
}
```

### Code Style

- Use 4 spaces for indentation
- Use single quotes for strings
- Add semicolons at line endings
- Use meaningful variable names
- Keep functions focused and small
- Maximum line length: 120 characters

### File Organization

```
src/
├── types.ts          # Type definitions
├── [module].ts       # Module implementation
└── app.ts           # Main application
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` (no "I" prefix)
- **Private methods**: `private camelCase`

## 🔒 Security Guidelines

### Critical Rules

1. **Never commit private keys or passwords**
2. **Always encrypt sensitive data**
3. **Validate all user inputs**
4. **Use parameterized queries** (for any future backend)
5. **Follow OWASP security practices**
6. **Test security features thoroughly**

### Security Review Checklist

- [ ] No hardcoded credentials
- [ ] Input validation implemented
- [ ] Encryption properly implemented
- [ ] No sensitive data in logs
- [ ] Error messages don't leak info
- [ ] Dependencies are up to date
- [ ] No XSS vulnerabilities
- [ ] CSRF protection (if applicable)

## 🧪 Testing

### Manual Testing

Before submitting a PR:
1. Test on multiple browsers (Chrome, Firefox, Safari, Edge)
2. Test on different screen sizes
3. Test all user flows
4. Test error scenarios
5. Verify data persistence
6. Check console for errors
7. Test with small amounts on testnet

### Test Cases to Cover

- Password encryption/decryption
- Wallet creation and management
- Transaction execution
- Data export/import
- Error handling
- UI responsiveness
- Database operations

## 📚 Documentation

### Update Documentation When:

- Adding new features
- Changing existing behavior
- Modifying configuration
- Adding dependencies
- Changing security features
- Updating deployment process

### Documentation Standards

- Use clear, concise language
- Include code examples
- Add screenshots for UI changes
- Update README if needed
- Document breaking changes
- Keep CHANGELOG updated

## 🎯 Development Workflow

1. **Setup development environment**
   ```bash
   npm install
   npm run dev
   ```

2. **Make changes incrementally**
   - One feature per PR
   - Keep commits focused
   - Test after each change

3. **Run type checking**
   ```bash
   npm run type-check
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Test the build**
   ```bash
   npm run serve
   ```

## 🐛 Debugging

### Debug Mode

Add debug logging:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

### Common Issues

- **Build fails**: Clear node_modules and reinstall
- **Type errors**: Check tsconfig.json settings
- **Runtime errors**: Check browser console
- **Database issues**: Clear IndexedDB and retry

## 📋 Commit Message Format

Use conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes
- **refactor**: Code refactoring
- **test**: Adding tests
- **chore**: Build process or auxiliary tool changes

Examples:
```
feat(wallet): Add multi-wallet support

Added ability to manage multiple master wallets
for different operations.

Closes #123
```

```
fix(crypto): Fix encryption IV generation

Fixed issue where IV was not properly randomized,
improving security of encrypted data.
```

## 🔄 Review Process

### For Reviewers

- Check code quality and style
- Verify security implications
- Test functionality locally
- Review documentation updates
- Check for breaking changes
- Ensure backward compatibility

### For Contributors

- Respond to feedback promptly
- Make requested changes
- Update based on review comments
- Keep PR focused and small
- Be patient during review

## 🎨 UI/UX Guidelines

- Maintain consistent design language
- Ensure accessibility (WCAG 2.1)
- Support keyboard navigation
- Provide clear error messages
- Use loading states appropriately
- Keep interfaces intuitive
- Test on multiple devices

## 🚀 Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release branch
4. Test thoroughly
5. Merge to main
6. Tag release
7. Deploy to production

## 📞 Getting Help

- Check existing documentation
- Search closed issues
- Ask in discussions
- Contact maintainers

## 🙏 Recognition

Contributors will be recognized in:
- README contributors section
- Release notes
- Project documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Mass Token Buy Bot! Your efforts help make this project better for everyone.
