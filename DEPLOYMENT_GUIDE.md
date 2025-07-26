# Cat Fighter - Online Multiplayer Deployment Guide 🚀

## Quick Deploy to Railway (Recommended)

### Step 1: Sign up to Railway
1. Go to **[railway.app](https://railway.app)**
2. Click **"Start a New Project"**
3. Sign in with your **GitHub account**

### Step 2: Deploy from GitHub
1. Click **"Deploy from GitHub repo"**
2. Select your **`WebCatFighter`** repository
3. Railway will automatically detect it's a Node.js project
4. Click **"Deploy Now"**

### Step 3: Get your server URL
1. Once deployed, Railway will give you a URL like: `https://your-app-name.up.railway.app`
2. **Copy this URL** - you'll need it for the next step

### Step 4: Update your game to use the real server
1. Open `game.js`
2. Find the line with `// const SERVER_URL = 'http://localhost:3000';`
3. Replace it with your Railway URL: `const SERVER_URL = 'https://your-app-name.up.railway.app';`
4. Remove the demo mode code and enable real multiplayer

---

## Alternative: Deploy to Other Services

### Render.com
1. Go to [render.com](https://render.com)
2. Connect your GitHub
3. Create new "Web Service"
4. Select your repository
5. Set build command: `npm install`
6. Set start command: `node server.js`

### Heroku
1. Go to [heroku.com](https://heroku.com)
2. Create new app
3. Connect to GitHub
4. Enable automatic deploys
5. Manual deploy from main branch

---

## Testing Your Deployment

1. Visit your deployed URL in a browser
2. You should see your Cat Fighter game
3. Try creating and joining rooms from different devices
4. Share room codes with friends!

---

## Troubleshooting

### If deployment fails:
- Check that `package.json` exists
- Verify all dependencies are listed
- Make sure `server.js` is in the root directory

### If rooms don't work:
- Check browser console for errors
- Verify the SERVER_URL is correctly set
- Test with different devices/networks

---

## What happens after deployment:

✅ **Real cross-device multiplayer**  
✅ **Room codes work between different phones/computers**  
✅ **Real-time game synchronization**  
✅ **No more "demo mode" limitations**

**Ready to play with friends online! 🎮**
