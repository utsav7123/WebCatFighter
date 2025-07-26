# Cat Fighter - Web Edition

A fun 2D fighting game featuring cats! Battle against AI or play with friends locally and online.

## 🎮 Game Modes
- **Single Player**: Fight against AI
- **Two Player**: Local multiplayer on same device
- **Online Multiplayer**: Play with friends across devices (requires server setup)

## 📱 Platform Support
- **Desktop**: Full keyboard controls
- **Mobile**: Touch screen controls with keyboard-like layout
- **Cross-platform**: Play between desktop and mobile devices

## 🎯 Controls

### Player 1 (Desktop):
- **Move**: A/D
- **Jump**: W
- **Light Attack**: R
- **Heavy Attack**: T

### Player 2 (Desktop):
- **Move**: Arrow Left/Right
- **Jump**: Arrow Up
- **Light Attack**: Numpad 1
- **Heavy Attack**: Numpad 2

### Mobile Controls:
- Touch controls automatically appear on mobile devices
- Keyboard-like layout with jump button positioned above movement arrows

## 🌐 Online Multiplayer Setup

### Current Status: DEMO MODE
The game currently runs in demo mode for online multiplayer. For **real cross-device multiplayer**, you need to deploy the included server.

### How to Enable Real Online Multiplayer:

1. **Deploy the Server**:
   - Upload `server.js` and `package.json` to a hosting service
   - Recommended services: [Railway](https://railway.app), [Render](https://render.com), or [Heroku](https://heroku.com)

2. **Update Game Configuration**:
   - Modify the game code to connect to your deployed server URL
   - Replace the demo cloudServer with real socket.io connection

3. **Server Commands**:
   ```bash
   npm install
   npm start
   ```

### Free Hosting Options:
- **Railway**: Free tier with easy deployment
- **Render**: Free tier with GitHub integration  
- **Vercel**: For frontend hosting
- **Netlify**: For frontend hosting

## 🚀 Quick Start

### Play Now (Local/Demo):
1. Open `index.html` in a web browser
2. Choose your game mode
3. Enjoy!

### Local Development Server:
```bash
python -m http.server 8000
# or
npx serve
```

## 🎨 Game Features

- **Pixel Art Graphics**: Crisp, retro-style visuals
- **Sound Effects**: Jump, attack, and background music
- **Health System**: Strategic combat with health bars
- **Mouse Healing**: Catch mice to restore health
- **Platform Combat**: Multi-level fighting stages
- **Mobile Responsive**: Optimized for touch devices

## 🔧 Technical Details

- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Backend**: Node.js with Socket.io (for real multiplayer)
- **Graphics**: Pixel art with anti-aliasing disabled for crisp rendering
- **Audio**: Web Audio API with fallback handling

## 📄 File Structure

```
WebCatFighter/
├── index.html          # Main game page
├── game.js            # Game logic and engine
├── style.css          # Styling and mobile responsive design
├── server.js          # Multiplayer server (Node.js)
├── package.json       # Server dependencies
└── assets/           # Game assets
    ├── cat1.png      # Player 1 sprite
    ├── cat2.png      # Player 2 sprite
    ├── bakground.jpg # Background image
    └── *.mp3         # Sound effects and music
```

## 🎭 Game Mechanics

- **Combat**: Light and heavy attacks with different damage and cooldowns
- **Movement**: Smooth character movement with gravity and platform physics
- **Healing**: Mice appear randomly - catch them to restore health
- **Victory**: First player to reduce opponent's health to zero wins

## 🐛 Known Issues

- Online multiplayer currently in demo mode (requires server deployment)
- Some mobile browsers may have audio restrictions
- Room codes only work locally without server deployment

## 🤝 Contributing

Feel free to fork this project and submit pull requests for improvements!

## 📜 License

This project is open source. Feel free to use and modify as needed.

---

**Live Demo**: [Play Cat Fighter](https://utsav7123.github.io/WebCatFighter/)

**Need Help?** Check the server.js file for multiplayer setup instructions.
