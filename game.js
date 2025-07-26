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
            opponent.health -= dmg;
            opponent.hurt_timer = 18;
            opponent.frame = 3;
            opponent.rect.x += this.facing * 10;
            playSound('hit');
            playSound(type === 'light' ? 'punch_light' : 'punch_heavy');
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
    ctx.fillText('Press 1 for Single Player', CONFIG.WIN_W/2, CONFIG.WIN_H/2);
    ctx.fillText('Press 2 for Two Players', CONFIG.WIN_W/2, CONFIG.WIN_H/2 + 50);
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
            p1.update(p2);
            if (gameState === "2player") {
                p2.update(p1);
            } else {
                p2.aiControl(p1);
                p2.physics();
            }
        } else {
            if (p1.eating > 0) p1.update(p2);
            if (p2.eating > 0) p2.update(p1);
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
        if (!currentMouse && !p1.eating && !p2.eating && !p1.winner && !p2.winner) {
            if (Math.random() < CONFIG.MOUSE_SPAWN_CHANCE) {
                currentMouse = new Mouse(Math.random() < 0.5);
            }
        }
        
        if (currentMouse) {
            if (currentMouse.update()) {
                currentMouse = null;
            } else {
                // Check collision with players
                for (const player of [p1, p2]) {
                    if (!player.eating && currentMouse && currentMouse.collidesWith(player)) {
                        player.eatMouse();
                        currentMouse = null;
                        break; // Exit loop since mouse is eaten
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