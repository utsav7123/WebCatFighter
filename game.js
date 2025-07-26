// Game Configuration
const CONFIG = {
    WIN_W: 900,
    WIN_H: 500,
    FPS: 60,
    GRAVITY: 0.8,
    GROUND_Y: 440,
    FRAME_W: 16,
    FRAME_H: 16,
    SCALE: 3,
    MOUSE_SPEED: 3,
    MOUSE_SPAWN_CHANCE: 0.001,
    EAT_ANIMATION_FRAMES: 60,
    AI_DIFFICULTY: 0.7
};

// Platforms
const PLATFORMS = [
    { x: 0, y: CONFIG.GROUND_Y, w: CONFIG.WIN_W, h: 20 },
    { x: 150, y: 380, w: 120, h: 20 },
    { x: 400, y: 320, w: 120, h: 20 },
    { x: 650, y: 260, w: 120, h: 20 },
    { x: 250, y: 200, w: 120, h: 20 },
    { x: 550, y: 140, w: 120, h: 20 }
];

// Game State
let gameState = "menu";
let canvas, ctx;
let keys = {};
let audioEnabled = false;
let currentMouse = null;

// Online Multiplayer
let socket = null;
let isOnline = false;
let roomCode = null;
let playerRole = null; // 'host' or 'guest'
let onlineOpponent = null;

// SERVER CONFIGURATION
// STEP 1: Deploy server.js to Railway (see DEPLOYMENT_GUIDE.md) ✅ DONE
// STEP 2: Replace the URL below with your Railway app URL ✅ DONE
// STEP 3: Uncomment the line below and comment out the demo cloudServer ✅ DONE
const SERVER_URL = 'https://webcatfighter-production.up.railway.app'; // Your deployed Railway URL

// DEMO MODE (DISABLED - Real server is now active!)
/*
// IMPORTANT: This is a demo version
// For real cross-device multiplayer, you need the server.js file running on a hosting service
// For now, this simulates the room system for local testing

let cloudServer = {
    // Demo mode - simulates room creation for local testing
    async createRoom(code) {
        const roomData = {
            code: code,
            host: true,
            guest: false,
            hostReady: true,
            guestReady: false,
            created: Date.now(),
            expires: Date.now() + (60 * 60 * 1000) // 1 hour
        };
        
        localStorage.setItem(`catfighter_room_${code}`, JSON.stringify(roomData));
        return true;
    },
    
    async joinRoom(code) {
        // In demo mode, any valid 6-character code will "work"
        if (code && code.length === 6) {
            const roomData = {
                code: code,
                host: true,
                guest: true,
                hostReady: true,
                guestReady: true,
                created: Date.now(),
                expires: Date.now() + (60 * 60 * 1000)
            };
            
            localStorage.setItem(`catfighter_room_${code}`, JSON.stringify(roomData));
            return { success: true };
        }
        
        return { success: false, reason: 'not_found' };
    },
    
    async getRoomStatus(code) {
        const stored = localStorage.getItem(`catfighter_room_${code}`);
        if (stored) {
            const room = JSON.parse(stored);
            if (Date.now() <= room.expires) {
                return room;
            }
        }
        return null;
    }
};
*/

// REAL MULTIPLAYER (Now active with Railway server!)
function initializeRealMultiplayer() {
    if (typeof io === 'undefined') {
        console.error('Socket.io not loaded. Make sure socket.io script is included in index.html');
        return false;
    }
    
    socket = io(SERVER_URL);
    
    socket.on('connect', () => {
        console.log('Connected to server');
        console.log('Socket ID:', socket.id);
    });
    
    socket.on('roomCreated', (data) => {
        console.log('Room created:', data);
        roomCode = data.roomCode;
        playerRole = data.role;
        isOnline = true;
        document.getElementById('roomCode').value = roomCode;
        document.getElementById('roomCode').placeholder = 'Your room code';
        showRoomStatus(`Room created! Code: ${roomCode}\nWaiting for player to join...`, 'connected');
        
        // Wait for another player
        socket.on('playerJoined', () => {
            showRoomStatus('Player joined! Starting game...', 'connected');
            setTimeout(() => {
                startOnlineGame();
            }, 2000);
        });
    });
    
    socket.on('roomJoined', (data) => {
        console.log('Room joined:', data);
        roomCode = data.roomCode;
        playerRole = data.role;
        isOnline = true;
        showRoomStatus('Joined room! Starting game...', 'connected');
    });
    
    socket.on('gameStart', () => {
        console.log('Game starting!');
        startOnlineGame();
    });
    
    socket.on('roomError', (message) => {
        console.log('Room error:', message);
        showRoomStatus(`Error: ${message}`, 'error');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('connect_error', (error) => {
        console.log('Connection error:', error);
        showRoomStatus('Failed to connect to server', 'error');
    });
    
    socket.on('opponentUpdate', (data) => {
        // Update opponent's position and state
        if (gameState === "online" && onlineOpponent) {
            onlineOpponent.rect.x = data.x;
            onlineOpponent.rect.y = data.y;
            // DON'T update health from network - health changes happen locally when hit
            // onlineOpponent.health = data.health;
            onlineOpponent.frame = data.frame;
            onlineOpponent.facing = data.facing;
            onlineOpponent.dead = data.dead || false;
            onlineOpponent.winner = data.winner || false;
            onlineOpponent.eating = data.eating || 0;
        }
    });
    
    socket.on('opponentHealthUpdate', (data) => {
        // Handle when the opponent tells us our health was reduced
        if (gameState === "online") {
            const myPlayer = playerRole === 'host' ? p1 : p2;
            console.log(`[${playerRole}] Receiving opponentHealthUpdate - My health changed from ${myPlayer.health} to ${data.health}`);
            myPlayer.health = data.health;
            myPlayer.dead = data.dead || false;
            if (myPlayer.dead) {
                myPlayer.frame = 4;
            }
        }
    });
    
    socket.on('myHealthUpdate', (data) => {
        // Handle when the opponent's health changes (they healed or got hurt)
        if (gameState === "online" && onlineOpponent) {
            console.log(`[${playerRole}] Receiving myHealthUpdate - Opponent health changed from ${onlineOpponent.health} to ${data.health}`);
            onlineOpponent.health = data.health;
            onlineOpponent.dead = data.dead || false;
        }
    });
    
    socket.on('mouseSpawned', (data) => {
        // Guest receives mouse spawn from host
        if (gameState === "online" && playerRole === 'guest') {
            currentMouse = new Mouse(data.fromRight);
        }
    });
    
    socket.on('mouseUpdate', (data) => {
        // Guest receives mouse position update from host
        if (gameState === "online" && playerRole === 'guest' && currentMouse) {
            currentMouse.rect.x = data.x;
            currentMouse.rect.y = data.y;
        }
    });
    
    socket.on('mouseRemoved', () => {
        // Guest receives mouse removal from host
        if (gameState === "online" && playerRole === 'guest') {
            if (currentMouse) {
                stopSound('mice');
                currentMouse = null;
            }
        }
    });
    
    socket.on('mouseEaten', (data) => {
        // Handle when opponent eats the mouse
        if (gameState === "online") {
            if (currentMouse) {
                stopSound('mice');
                currentMouse = null;
            }
        }
    });
    
    socket.on('playerDisconnected', () => {
        showRoomStatus('Other player disconnected', 'error');
        // Handle player disconnect (maybe return to menu)
    });
    
    return true;
}

let lastUpdateTime = 0;
const UPDATE_INTERVAL = 16; // ~60 FPS

function sendGameUpdate() {
    if (socket && isOnline && gameState === "online") {
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_INTERVAL) return; // Throttle updates
        lastUpdateTime = now;
        
        const myPlayer = playerRole === 'host' ? p1 : p2;
        socket.emit('gameUpdate', {
            x: myPlayer.rect.x,
            y: myPlayer.rect.y,
            frame: myPlayer.frame,
            facing: myPlayer.facing,
            dead: myPlayer.dead,
            winner: myPlayer.winner,
            eating: myPlayer.eating
        });
    }
}

function sendHealthUpdate() {
    if (socket && isOnline && gameState === "online") {
        const myPlayer = playerRole === 'host' ? p1 : p2;
        socket.emit('myHealthUpdate', {
            health: myPlayer.health,
            dead: myPlayer.dead
        });
    }
}


// Assets
let assets = {
    images: {},
    sounds: {},
    loaded: 0,
    total: 0
};

// Fighter Class
class Fighter {
    constructor(x, y, spriteKey, controls, facing) {
        this.rect = { x, y, w: 30, h: 80 };
        this.vel_y = 0;
        this.health = 200;
        this.spriteKey = spriteKey;
        this.controls = controls;
        this.facing = facing;
        this.on_ground = false;
        this.attack_cd = 0;
        this.frame = 0;
        this.anim_timer = 0;
        this.hurt_timer = 0;
        this.dead = false;
        this.winner = false;
        this.eating = 0;
        this.pending_heal = 0;
    }

    handleInput(opponent) {
        if (this.dead || this.winner || this.eating > 0) return;
        
        let dx = 0;
        if (keys[this.controls.left]) {
            dx = -5;
            this.facing = -1;
        }
        if (keys[this.controls.right]) {
            dx = 5;
            this.facing = 1;
        }
        if (keys[this.controls.jump] && this.on_ground) {
            this.vel_y = -15;
            this.frame = 2;
            this.anim_timer = 15;
            playSound('jump');
        }
        
        this.rect.x += dx;

        if (this.attack_cd <= 0) {
            if (keys[this.controls.light]) {
                this.attack(opponent, 10, 50, 8, 15, 'light');
            } else if (keys[this.controls.heavy]) {
                this.attack(opponent, 25, 40, 15, 35, 'heavy');
            }
        }
    }

    attack(opponent, dmg, reach, dur, cd, type) {
        this.frame = 1;
        this.anim_timer = 7;
        this.attack_cd = cd;
        
        const attackRect = {
            x: this.rect.x + this.facing * reach/2 - reach/2,
            y: this.rect.y + 20,
            w: reach,
            h: 40
        };

        if (this.collideRect(attackRect, opponent.rect) && !opponent.dead) {
            const oldHealth = opponent.health;
            opponent.health -= dmg;
            const newHealth = opponent.health;
            opponent.hurt_timer = 18;
            opponent.frame = 3;
            opponent.rect.x += this.facing * 10;
            playSound('hit');
            playSound(type === 'light' ? 'punch_light' : 'punch_heavy');
            
            // Send opponent's health update in multiplayer when we hit them
            if (gameState === "online" && socket) {
                console.log(`[${playerRole}] I hit opponent! Their health: ${oldHealth} -> ${newHealth}`);
                socket.emit('opponentHealthUpdate', {
                    health: opponent.health,
                    dead: opponent.health <= 0
                });
            }
        }
    }

    physics() {
        if (this.dead) return;
        
        this.vel_y += CONFIG.GRAVITY;
        this.rect.y += this.vel_y;
        this.on_ground = false;

        for (let plat of PLATFORMS) {
            if (this.vel_y >= 0 &&
                this.rect.y + this.rect.h >= plat.y &&
                this.rect.y + this.rect.h - this.vel_y <= plat.y + 5 &&
                this.rect.x + this.rect.w > plat.x &&
                this.rect.x < plat.x + plat.w) {
                
                this.rect.y = plat.y - this.rect.h;
                this.vel_y = 0;
                this.on_ground = true;
                break;
            }
        }
    }

    update(opponent) {
        if (this.eating > 0) {
            this.frame = this.eating > CONFIG.EAT_ANIMATION_FRAMES/2 ? 7 : 8;
            this.eating--;
            if (this.eating === 0 && this.pending_heal > 0) {
                this.health += this.pending_heal;
                this.pending_heal = 0;
                
                // Send health update in multiplayer when we heal from eating mouse
                if (gameState === "online" && socket) {
                    sendHealthUpdate();
                }
            }
            return;
        }

        if (!this.dead) {
            if (this.attack_cd > 0) this.attack_cd--;
            if (this.hurt_timer > 0) this.hurt_timer--;
            if (this.anim_timer > 0) this.anim_timer--;
            else if (this.hurt_timer === 0 && !this.winner) this.frame = 0;

            this.handleInput(opponent);
            this.physics();
            
            if (this.health <= 0) {
                this.health = 0;
                this.dead = true;
                this.frame = 4;
            }
        }
    }

    aiControl(opponent) {
        if (this.dead || this.winner) return;
        
        // Check for death
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
            this.frame = 4;
            return;
        }
        
        const dist_x = opponent.rect.x - this.rect.x;
        const dist_y = opponent.rect.y - this.rect.y;
        
        if (this.anim_timer > 0) this.anim_timer--;
        else if (this.hurt_timer === 0 && !this.winner) this.frame = 0;

        if (Math.random() < CONFIG.AI_DIFFICULTY) {
            const optimal_distance = this.health > 50 ? 60 : 100;
            let dx = 0;

            if (Math.abs(dist_x) > optimal_distance) {
                dx = dist_x > 0 ? 5 : -5;
                this.facing = dist_x > 0 ? 1 : -1;
            } else if (Math.abs(dist_x) < optimal_distance - 30) {
                dx = dist_x > 0 ? -5 : 5;
                this.facing = dist_x > 0 ? -1 : 1;
            }

            this.rect.x += dx;

            if (this.on_ground && dist_y < -40) {
                this.vel_y = -15;
                this.frame = 2;
                this.anim_timer = 15;
                playSound('jump');
            }

            if (this.attack_cd <= 0 && Math.abs(dist_x) < 80) {
                if (Math.random() < 0.6) {
                    this.attack(opponent, 25, 40, 15, 35, 'heavy');
                } else {
                    this.attack(opponent, 10, 50, 8, 15, 'light');
                }
            }
        }

        if (this.attack_cd > 0) this.attack_cd--;
        if (this.hurt_timer > 0) this.hurt_timer--;
    }

    eatMouse() {
        if (!this.dead && this.eating === 0) {
            this.eating = CONFIG.EAT_ANIMATION_FRAMES;
            const missing_health = 200 - this.health;
            this.pending_heal = Math.floor(missing_health / 2);
            stopSound('mice');
            playSound('eating');
            return true;
        }
        return false;
    }

    draw() {
        const sprite = assets.images[this.spriteKey];
        if (!sprite) return;

        const frame_id = Math.max(0, Math.min(this.frame, 8));
        const sx = frame_id * CONFIG.FRAME_W;
        const sy = 0;
        const sw = CONFIG.FRAME_W;
        const sh = CONFIG.FRAME_H;
        
        const dw = sw * CONFIG.SCALE;
        const dh = sh * CONFIG.SCALE;
        const dx = this.rect.x + this.rect.w/2 - dw/2;
        const dy = this.rect.y + this.rect.h - dh;

        ctx.save();
        if (this.facing === -1) {
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, sx, sy, sw, sh, -dx - dw, dy, dw, dh);
        } else {
            ctx.drawImage(sprite, sx, sy, sw, sh, dx, dy, dw, dh);
        }
        ctx.restore();
    }

    collideRect(rect1, rect2) {
        return rect1.x < rect2.x + rect2.w &&
               rect1.x + rect1.w > rect2.x &&
               rect1.y < rect2.y + rect2.h &&
               rect1.y + rect1.h > rect2.y;
    }
}

// Mouse Class
class Mouse {
    constructor(from_right) {
        this.rect = {
            x: from_right ? CONFIG.WIN_W + 20 : -20,
            y: CONFIG.GROUND_Y - 20,
            w: 20,
            h: 20
        };
        this.direction = from_right ? -1 : 1;
        this.frame = 6;
        playLoopSound('mice');
    }

    update() {
        this.rect.x += this.direction * CONFIG.MOUSE_SPEED;
        const off_screen = this.rect.x + this.rect.w < -20 || this.rect.x > CONFIG.WIN_W + 20;
        if (off_screen) {
            stopSound('mice');
        }
        return off_screen;
    }

    draw() {
        const sprite = assets.images['cat1'];
        if (!sprite) return;

        const sx = this.frame * CONFIG.FRAME_W;
        const sy = 0;
        const sw = CONFIG.FRAME_W;
        const sh = CONFIG.FRAME_H;
        
        const dw = sw * CONFIG.SCALE;
        const dh = sh * CONFIG.SCALE;
        const dx = this.rect.x + this.rect.w/2 - dw/2;
        const dy = this.rect.y + this.rect.h - dh;

        ctx.save();
        if (this.direction === 1) {
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, sx, sy, sw, sh, -dx - dw, dy, dw, dh);
        } else {
            ctx.drawImage(sprite, sx, sy, sw, sh, dx, dy, dw, dh);
        }
        ctx.restore();
    }

    collidesWith(fighter) {
        return this.rect.x < fighter.rect.x + fighter.rect.w &&
               this.rect.x + this.rect.w > fighter.rect.x &&
               this.rect.y < fighter.rect.y + fighter.rect.h &&
               this.rect.y + this.rect.h > fighter.rect.y;
    }
}

// Game Objects
let p1, p2;

// Utility Functions
function drawHealthBar(x, y, health) {
    const pct = (health / 200) * 100;
    const width = 200;
    const height = 20;
    
    ctx.fillStyle = 'black';
    ctx.fillRect(x-2, y-2, width+4, height+4);
    ctx.fillStyle = '#dc3545';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#28a745';
    ctx.fillRect(x, y, width * pct / 100, height);
}

function drawMenu() {
    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Cat Fighter', CONFIG.WIN_W/2, CONFIG.WIN_H/3);
    
    ctx.font = '24px Arial';
    if (isOnline && roomCode) {
        ctx.fillText(`Online Room: ${roomCode}`, CONFIG.WIN_W/2, CONFIG.WIN_H/2 - 50);
        ctx.fillText(`You are: ${playerRole}`, CONFIG.WIN_W/2, CONFIG.WIN_H/2 - 20);
    } else {
        ctx.fillText('Press 1 for Single Player', CONFIG.WIN_W/2, CONFIG.WIN_H/2);
        ctx.fillText('Press 2 for Two Players', CONFIG.WIN_W/2, CONFIG.WIN_H/2 + 50);
    }
}

function reset() {
    p1 = new Fighter(150, CONFIG.GROUND_Y - 80, 'cat1', {
        left: 'KeyA', right: 'KeyD', jump: 'KeyW',
        light: 'KeyR', heavy: 'KeyT'
    }, 1);
    
    p2 = new Fighter(CONFIG.WIN_W - 180, CONFIG.GROUND_Y - 80, 'cat2', {
        left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp',
        light: 'Numpad1', heavy: 'Numpad2'
    }, -1);
}

function isAnyoneEating() {
    return p1.eating > 0 || p2.eating > 0;
}

// Audio Functions
function playSound(soundName) {
    const sound = assets.sounds[soundName];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Audio play failed:', e));
    }
}

function playLoopSound(soundName) {
    const sound = assets.sounds[soundName];
    if (sound) {
        sound.loop = true;
        sound.play().catch(e => console.log('Audio play failed:', e));
    }
}

function stopSound(soundName) {
    const sound = assets.sounds[soundName];
    if (sound) {
        sound.pause();
        sound.currentTime = 0;
        sound.loop = false;
    }
}

// Asset Loading
function loadAssets() {
    const imagesToLoad = ['cat1.png', 'cat2.png', 'bakground.jpg'];
    const soundsToLoad = ['bgm.mp3', 'punch_light.mp3', 'punch_heavy.mp3', 'jump.mp3', 'hit.mp3', 'mice.mp3', 'eating.mp3'];
    
    assets.total = imagesToLoad.length + soundsToLoad.length;
    
    // Load images
    imagesToLoad.forEach(src => {
        const img = new Image();
        img.onload = () => {
            assets.loaded++;
            if (assets.loaded === assets.total) startGame();
        };
        img.onerror = () => {
            assets.loaded++;
            console.log('Failed to load image:', src);
            if (assets.loaded === assets.total) startGame();
        };
        img.src = `assets/${src}`;
        assets.images[src.split('.')[0]] = img;
    });
    
    // Load sounds
    soundsToLoad.forEach(src => {
        const audio = new Audio();
        audio.oncanplaythrough = () => {
            assets.loaded++;
            if (assets.loaded === assets.total) startGame();
        };
        audio.onerror = () => {
            assets.loaded++;
            console.log('Failed to load sound:', src);
            if (assets.loaded === assets.total) startGame();
        };
        audio.src = `assets/${src}`;
        assets.sounds[src.split('.')[0]] = audio;
    });
}

// Input Handling
function setupInput() {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        
        if (e.code === 'F1') {
            e.preventDefault();
            restartGame();
        } else if (gameState === 'menu') {
            if (e.code === 'Digit1') startSinglePlayer();
            else if (e.code === 'Digit2') startTwoPlayer();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // Mobile touch controls
    setupTouchControls();
    
    // Detect mobile device
    if (isMobile()) {
        document.getElementById('mobileControls').style.display = 'flex';
    }
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768);
}

function setupTouchControls() {
    const touchButtons = document.querySelectorAll('.touch-btn');
    
    touchButtons.forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const key = btn.dataset.key;
            handleTouchInput(key, true);
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            const key = btn.dataset.key;
            handleTouchInput(key, false);
        });
        
        // Prevent context menu on long press
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
}

function handleTouchInput(action, pressed) {
    const keyMappings = {
        'left': 'KeyA',
        'right': 'KeyD', 
        'jump': 'KeyW',
        'light': 'KeyR',
        'heavy': 'KeyT'
    };
    
    if (keyMappings[action]) {
        keys[keyMappings[action]] = pressed;
    }
}

// Game Control Functions
function enableAudio() {
    if (!audioEnabled && assets.sounds.bgm) {
        audioEnabled = true;
        const bgm = assets.sounds.bgm;
        bgm.loop = true;
        bgm.volume = 0.5;
        bgm.play().catch(e => console.log('BGM play failed:', e));
    }
}

function startSinglePlayer() {
    enableAudio();
    gameState = "1player";
    reset();
    currentMouse = null;
}

function startTwoPlayer() {
    enableAudio();
    gameState = "2player";
    reset();
    currentMouse = null;
}

function restartGame() {
    gameState = "menu";
    reset();
    currentMouse = null;
    stopSound('mice');
}

// Online Multiplayer Functions
async function createRoom() {
    console.log('Creating room...');
    document.getElementById('roomTitle').textContent = 'Create Room';
    document.getElementById('roomCode').value = '';
    document.getElementById('roomCode').disabled = true;
    document.getElementById('roomCode').placeholder = 'Connecting to server...';
    document.getElementById('roomUI').style.display = 'flex';
    
    // Use real server (Railway)
    if (typeof SERVER_URL !== 'undefined' && initializeRealMultiplayer()) {
        showRoomStatus('Creating room...', 'waiting');
        console.log('Emitting createRoom event');
        socket.emit('createRoom');
        return;
    } else {
        console.log('Failed to initialize multiplayer');
        showRoomStatus('Failed to connect to server. Please try again.', 'error');
    }
}

async function waitForPlayer() {
    const checkForPlayer = setInterval(async () => {
        const room = await cloudServer.getRoomStatus(roomCode);
        if (room && room.guest && room.guestReady) {
            clearInterval(checkForPlayer);
            showRoomStatus('Player joined! Starting game...', 'connected');
            setTimeout(() => {
                startOnlineGame();
            }, 2000);
        }
    }, 3000); // Check every 3 seconds
    
    // Stop checking after 5 minutes (timeout)
    setTimeout(() => {
        clearInterval(checkForPlayer);
        showRoomStatus('Room timed out. No player joined.', 'error');
    }, 300000); // 5 minutes
}

function joinRoom() {
    document.getElementById('roomTitle').textContent = 'Join Room';
    document.getElementById('roomCode').placeholder = 'Enter room code';
    document.getElementById('roomCode').disabled = false;
    document.getElementById('roomCode').value = '';
    document.getElementById('roomUI').style.display = 'flex';
    
    // Reset button
    const connectBtn = document.querySelector('#roomUI button');
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
    
    // Clear any previous status
    document.getElementById('roomStatus').innerHTML = '';
}

function closeRoomUI() {
    document.getElementById('roomUI').style.display = 'none';
    document.getElementById('roomCode').value = '';
    document.getElementById('roomStatus').innerHTML = '';
    
    // Reset button
    const connectBtn = document.querySelector('#roomUI button');
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
}

async function handleRoomAction() {
    const title = document.getElementById('roomTitle').textContent;
    if (title === 'Create Room') {
        // Room already created, this shouldn't happen
        // But if it does, just close the UI
        closeRoomUI();
    } else {
        // Join room
        const code = document.getElementById('roomCode').value.trim().toUpperCase();
        if (code.length === 6) {
            await initializeOnlineGame('join', code);
        } else {
            showRoomStatus('Please enter a valid 6-character room code', 'error');
        }
    }
}

async function initializeOnlineGame(action, code = null) {
    if (action === 'create') {
        // This case is now handled in createRoom() function
        playerRole = 'host';
        
    } else if (action === 'join') {
        console.log('Joining room with code:', code);
        // Use real server (Railway)
        if (typeof SERVER_URL !== 'undefined' && initializeRealMultiplayer()) {
            showRoomStatus('Joining room...', 'waiting');
            console.log('Emitting joinRoom event with code:', code);
            socket.emit('joinRoom', code);
            roomCode = code;
            return;
        } else {
            console.log('Failed to initialize multiplayer for joining');
            showRoomStatus('Failed to connect to server. Please try again.', 'error');
        }
    }
}

function startOnlineGame() {
    closeRoomUI();
    isOnline = true;
    gameState = "online";
    enableAudio();
    reset();
    currentMouse = null;
    
    // Set up opponent reference for real-time sync
    // Host controls p1, Guest controls p2
    if (playerRole === 'host') {
        onlineOpponent = p2; // Host receives updates for p2 (guest's player)
        console.log('Host: I control p1, opponent is p2');
    } else if (playerRole === 'guest') {
        onlineOpponent = p1; // Guest receives updates for p1 (host's player)
        console.log('Guest: I control p2, opponent is p1');
    }
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function showRoomStatus(message, type) {
    const statusDiv = document.getElementById('roomStatus');
    statusDiv.innerHTML = message;
    statusDiv.className = `status-${type}`;
}

// Note: This is a simplified implementation
// For real online multiplayer, you would need:
// 1. A Node.js server with Socket.io
// 2. Real-time synchronization of game state
// 3. Proper latency handling and prediction

// Main Game Loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, CONFIG.WIN_W, CONFIG.WIN_H);
    
    // Draw background
    if (assets.images.bakground) {
        ctx.drawImage(assets.images.bakground, 0, 0, CONFIG.WIN_W, CONFIG.WIN_H);
    }
    
    if (gameState === "menu") {
        drawMenu();
    } else {
        // Update game logic
        if (!isAnyoneEating()) {
            if (gameState === "online") {
                // In online mode, each player only controls their own character
                if (playerRole === 'host') {
                    p1.update(p2); // Host controls p1
                    p2.physics(); // Guest's player still needs physics
                } else if (playerRole === 'guest') {
                    p2.update(p1); // Guest controls p2
                    p1.physics(); // Host's player still needs physics
                }
            } else {
                // Local multiplayer - both players update normally
                p1.update(p2);
                if (gameState === "2player") {
                    p2.update(p1);
                } else {
                    p2.aiControl(p1);
                    p2.physics();
                }
            }
        } else {
            if (p1.eating > 0) p1.update(p2);
            if (p2.eating > 0) p2.update(p1);
        }
        
        // Send multiplayer updates (now active with real server!)
        if (gameState === "online" && socket) {
            sendGameUpdate();
        }
        
        // Check for winner
        if (p1.dead && !p2.winner) {
            p2.winner = true;
            p2.frame = 5;
            if (currentMouse && !p2.eating) {
                p2.eatMouse();
                currentMouse = null;
            }
        }
        if (p2.dead && !p1.winner) {
            p1.winner = true;
            p1.frame = 5;
            if (currentMouse && !p1.eating) {
                p1.eatMouse();
                currentMouse = null;
            }
        }
        
        // Mouse spawning and updating
        if (gameState === "online") {
            // In multiplayer, only host controls mouse spawning
            if (playerRole === 'host' && !currentMouse && !p1.eating && !p2.eating && !p1.winner && !p2.winner) {
                if (Math.random() < CONFIG.MOUSE_SPAWN_CHANCE) {
                    const fromRight = Math.random() < 0.5;
                    currentMouse = new Mouse(fromRight);
                    // Send mouse spawn to guest
                    if (socket) {
                        socket.emit('mouseSpawned', { fromRight: fromRight });
                    }
                }
            }
        } else {
            // Local gameplay - original logic
            if (!currentMouse && !p1.eating && !p2.eating && !p1.winner && !p2.winner) {
                if (Math.random() < CONFIG.MOUSE_SPAWN_CHANCE) {
                    currentMouse = new Mouse(Math.random() < 0.5);
                }
            }
        }
        
        if (currentMouse) {
            if (currentMouse.update()) {
                currentMouse = null;
                // In multiplayer, host notifies guest when mouse is removed
                if (gameState === "online" && playerRole === 'host' && socket) {
                    socket.emit('mouseRemoved');
                }
            } else {
                // Send mouse position update in multiplayer
                if (gameState === "online" && playerRole === 'host' && socket) {
                    socket.emit('mouseUpdate', {
                        x: currentMouse.rect.x,
                        y: currentMouse.rect.y
                    });
                }
                
                // Check collision with players
                if (gameState === "online") {
                    // In multiplayer mode
                    const myPlayer = playerRole === 'host' ? p1 : p2;
                    const opponentPlayer = playerRole === 'host' ? p2 : p1;
                    
                    // Check if I (my player) ate the mouse
                    if (!myPlayer.eating && currentMouse && currentMouse.collidesWith(myPlayer)) {
                        myPlayer.eatMouse();
                        currentMouse = null;
                        // Host notifies guest, or guest notifies host
                        if (socket) {
                            socket.emit('mouseEaten', { eaterRole: playerRole });
                        }
                        if (playerRole === 'host') {
                            socket.emit('mouseRemoved');
                        }
                    }
                    // Check if opponent ate the mouse (only for host, since guest gets updates)
                    else if (playerRole === 'host' && !opponentPlayer.eating && currentMouse && currentMouse.collidesWith(opponentPlayer)) {
                        opponentPlayer.eatMouse();
                        currentMouse = null;
                        socket.emit('mouseRemoved');
                    }
                } else {
                    // Local gameplay - original logic
                    for (const player of [p1, p2]) {
                        if (!player.eating && currentMouse && currentMouse.collidesWith(player)) {
                            player.eatMouse();
                            currentMouse = null;
                            break; // Exit loop since mouse is eaten
                        }
                    }
                }
            }
        }
        
        // Draw ground
        ctx.fillStyle = 'black';
        ctx.fillRect(0, CONFIG.GROUND_Y, CONFIG.WIN_W, CONFIG.WIN_H - CONFIG.GROUND_Y);
        
        // Draw platforms
        PLATFORMS.forEach(plat => {
            ctx.fillStyle = 'black';
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        });
        
        // Draw mouse
        if (currentMouse) {
            currentMouse.draw();
        }
        
        // Draw players
        p1.draw();
        p2.draw();
        
        // Draw health bars
        drawHealthBar(20, 20, p1.health);
        drawHealthBar(CONFIG.WIN_W - 220, 20, p2.health);
        
        // Draw winner text
        if (p1.winner || p2.winner) {
            const winner = p1.winner ? "Player 1" : "Player 2";
            ctx.fillStyle = 'black';
            ctx.font = '32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${winner} wins! F1 = restart`, CONFIG.WIN_W/2, CONFIG.WIN_H/2);
        }
        
        // Keep cats inside screen
        [p1, p2].forEach(f => {
            f.rect.x = Math.max(0, Math.min(f.rect.x, CONFIG.WIN_W - f.rect.w));
        });
    }
    
    requestAnimationFrame(gameLoop);
}

// Initialize Game
function startGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Disable image smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    
    setupInput();
    reset();
    
    gameLoop();
}

// Start loading assets when page loads
window.addEventListener('load', loadAssets);