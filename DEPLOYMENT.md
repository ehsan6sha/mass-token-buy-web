# Deployment Guide

This guide covers deploying the Mass Token Buy Bot to GitHub Pages and other static hosting platforms.

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- GitHub account (for GitHub Pages)
- Git installed and configured

## 🚀 Quick Start

### 1. Build the Project

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

This creates a `dist` folder with all compiled assets.

### 2. Test Locally

```bash
# Run development server
npm run serve
```

Open http://localhost:8080 to test the application locally.

## 🌐 GitHub Pages Deployment

### Method 1: Automated Deployment (Recommended)

The project includes a GitHub Actions workflow for automatic deployment.

1. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" section
   - Source: GitHub Actions

2. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Automatic deployment**:
   - GitHub Actions will automatically build and deploy
   - Check the "Actions" tab for deployment status
   - Your site will be available at `https://username.github.io/repo-name`

### Method 2: Manual Deployment

```bash
# Build the project
npm run build

# Deploy dist folder to gh-pages branch
npm install -g gh-pages
gh-pages -d dist
```

Or using git subtree:

```bash
git add dist -f
git commit -m "Deploy to GitHub Pages"
git subtree push --prefix dist origin gh-pages
```

Then enable GitHub Pages in repository settings to serve from `gh-pages` branch.

## 🔧 Alternative Hosting Platforms

### Netlify

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

Or connect your GitHub repository to Netlify for automatic deployments:
- Build command: `npm run build`
- Publish directory: `dist`

### Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   npm run build
   vercel --prod
   ```

Or connect your GitHub repository to Vercel.

### Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages
2. Configure build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node.js version: 18

### AWS S3 + CloudFront

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Upload to S3**:
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

3. **Configure CloudFront** for HTTPS and caching

### Custom Web Server

After building, upload the `dist` folder contents to any web server:

```bash
# Build
npm run build

# Upload dist folder to your server
scp -r dist/* user@server:/var/www/html/
```

Configure your web server to serve `index.html` for all routes.

## ⚙️ Build Configuration

### Environment-Specific Builds

For different environments, you can modify `webpack.config.js`:

```javascript
// Example: Add environment variable
const webpack = require('webpack');

module.exports = {
  // ... existing config
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.RPC_URL': JSON.stringify(process.env.RPC_URL || 'https://mainnet.base.org')
    })
  ]
};
```

### Custom Domain

For GitHub Pages with custom domain:

1. **Add CNAME file** to `dist` folder:
   ```
   yourdomain.com
   ```

2. **Configure DNS** with your domain provider:
   - Type: CNAME
   - Name: www (or @)
   - Value: username.github.io

3. **Enable HTTPS** in GitHub Pages settings

## 🔒 Security Considerations

### HTTPS Required

Always serve the application over HTTPS:
- Protects sensitive data in transit
- Required for Web Crypto API
- Most hosting platforms provide free SSL

### Content Security Policy (CSP)

Add CSP headers to your hosting configuration:

```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline'; 
  connect-src 'self' https://mainnet.base.org https://api.bungee.exchange https://*.basescan.org;
  img-src 'self' data:;
```

### CORS Configuration

Ensure your RPC endpoint allows CORS requests if hosting on a custom domain.

## 📊 Performance Optimization

### Caching Headers

Configure your hosting to set appropriate cache headers:

```
# JavaScript and CSS (cache for 1 year)
*.js Cache-Control: public, max-age=31536000, immutable
*.css Cache-Control: public, max-age=31536000, immutable

# HTML (no cache)
*.html Cache-Control: no-cache, no-store, must-revalidate

# Images
*.png Cache-Control: public, max-age=31536000
*.svg Cache-Control: public, max-age=31536000
```

### Compression

Enable gzip or brotli compression on your server:

For nginx:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

## 🧪 Testing Deployment

After deployment, verify:

1. **Application loads** without console errors
2. **HTTPS is enforced**
3. **All assets load correctly**
4. **IndexedDB works** (test password unlock)
5. **RPC connectivity** to Base network
6. **Bungee API accessible**

Test checklist:
```bash
# Check HTTPS
curl -I https://your-deployment-url

# Check if index.html loads
curl https://your-deployment-url

# Check if JavaScript bundle loads
curl https://your-deployment-url/bundle.js
```

## 🔄 Continuous Deployment

### GitHub Actions Workflow

The included `.github/workflows/deploy.yml` automatically:
1. Triggers on push to main/master
2. Installs dependencies
3. Builds the project
4. Deploys to GitHub Pages

### Customize Workflow

Add additional steps as needed:

```yaml
- name: Run tests
  run: npm test

- name: Lint code
  run: npm run lint

- name: Type check
  run: npm run type-check
```

## 📱 Mobile Optimization

For mobile users:

1. **Ensure responsive design** is working
2. **Test on mobile browsers**
3. **Verify touch interactions**
4. **Check viewport meta tag** in index.html

## 🐛 Troubleshooting Deployment

### Build Fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Assets Not Loading

- Check file paths are relative
- Verify webpack output configuration
- Check server directory structure

### 404 Errors on Refresh

For single-page apps, configure your server to serve `index.html` for all routes:

**GitHub Pages**: Automatically handled

**Netlify**: Add `_redirects` file:
```
/*    /index.html   200
```

**Nginx**: 
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### IndexedDB Not Working

- Ensure site is served over HTTPS
- Check browser compatibility
- Verify no browser extensions blocking storage

## 📋 Pre-Deployment Checklist

- [ ] Code is built without errors
- [ ] All tests pass
- [ ] TypeScript type-checking passes
- [ ] Application tested locally
- [ ] All sensitive data removed from code
- [ ] HTTPS enabled
- [ ] Custom domain configured (if applicable)
- [ ] CSP headers set (if possible)
- [ ] Caching headers configured
- [ ] Compression enabled
- [ ] Mobile responsiveness verified
- [ ] Cross-browser testing completed
- [ ] README updated
- [ ] Version tagged in git

## 🎯 Post-Deployment

After successful deployment:

1. **Test the live site** thoroughly
2. **Monitor for errors** using browser console
3. **Share the URL** securely
4. **Document any issues**
5. **Collect user feedback**

## 📚 Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/pages)
- [Netlify Documentation](https://docs.netlify.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Webpack Production Guide](https://webpack.js.org/guides/production/)

---

For issues or questions about deployment, check the main README or open an issue in the repository.
