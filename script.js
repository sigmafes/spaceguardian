const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const socket = io('http://localhost:3000'); // Conectar al servidor

// Imágenes
const playerImg = new Image();
playerImg.src = 'player.png';

const bgImg = new Image();
bgImg.src = 'bg.jpeg';

const bg2Img = new Image();
bg2Img.src = 'bg2.jpg';

const bg3Img = new Image();
bg3Img.src = 'bg3.png';

const bg4Img = new Image();
bg4Img.src = 'bg4.png';

const logoImg = new Image();
logoImg.src = 'logo.png';

const bulletImg = new Image();
bulletImg.src = 'bl.png';

const ship2Img = new Image();
ship2Img.src = 'ship2.png';

const explosionSound = new Audio('exp.mp3');
const loseSound = new Audio('lose.mp3');
const enemyKillSound = new Audio('enm.mp3');
const kidesSound = new Audio('kides.mp3');
const stage1Music = new Audio('st1.mp3');
stage1Music.loop = true;
const stage2Music = new Audio('st2.mp3');
stage2Music.loop = true;
const stage3Music = new Audio('st3.mp3');
stage3Music.loop = true;
const stage4Music = new Audio('st4.mp3');
stage4Music.loop = true;

// Pantalla de inicio
const startScreen = document.getElementById('startScreen');
const logo = document.getElementById('logo');

let gameStarted = false;

function showStartScreen() {
    startScreen.style.transition = 'opacity 1s';
    setTimeout(() => {
        logo.style.display = 'block';
        logo.style.opacity = '1';
        if (sfxToggle.checked) kidesSound.play(); // Play kides.mp3 for logo intro only if SFX is enabled
        setTimeout(() => {
            logo.style.opacity = '0';
            startScreen.style.opacity = '0';
            setTimeout(() => {
                startScreen.style.display = 'none';
                gameStarted = true;
                // Show "Stage 1" text for 2 seconds with yellow border
                currentStageSpan.textContent = 1;
                stageNumberSpan.textContent = 1;
                stageDisplay.style.display = 'block';
                canvas.style.borderColor = 'yellow';
                setTimeout(() => {
                    stageDisplay.style.display = 'none';
                    canvas.style.borderColor = 'gray';
                }, 2000);
                // Start stage 1 music after intro
                if (musicToggle.checked) stage1Music.play();
            }, 1000);
        }, 1000);
    }, 1000);
}

showStartScreen();

let player = { x: 0, y: 0, id: null, dead: false, name: '' };
let otherPlayers = {};
let enemies = {};
let bullets = [];
let bulletIdCounter = 0;
let lastShootTime = 0;
const shootInterval = 250; // 4 balas por segundo (1000/4 = 250ms)
let powerUps = [];
let powerUpIdCounter = 0;
let powerUpEffect = null; // 'double' or 'triple'
let powerUpEndTime = 0;

let playerX = canvas.width / 2 - 16;
let playerY = canvas.height - 32;
const playerSpeed = 5;

// Elementos UI
const nameInput = document.getElementById('nameInput');
const changeNameBtn = document.getElementById('changeNameBtn');
const roomLivesSpan = document.getElementById('roomLives');
const playersCountSpan = document.getElementById('playersCount');
const shipsDestroyedSpan = document.getElementById('shipsDestroyed');
const currentStageSpan = document.getElementById('currentStage');
const stageDisplay = document.getElementById('stageDisplay');
const stageNumberSpan = document.getElementById('stageNumber');
const musicToggle = document.getElementById('musicToggle');
const sfxToggle = document.getElementById('sfxToggle');

// Teclas presionadas
const keys = {};
document.addEventListener('keydown', (e) => keys[e.key] = true);
document.addEventListener('keyup', (e) => keys[e.key] = false);

// Conexión al servidor
socket.on('connect', () => {
    console.log('Conectado al servidor, ID:', socket.id);
    player.id = socket.id;
    player.x = playerX;
    player.y = playerY;
    socket.emit('newPlayer', player);
});

// Game full
socket.on('gameFull', () => {
    window.location.href = 'full.html';
});

// Actualización de jugadores
socket.on('updatePlayers', (players) => {
    // Actualizar contador de jugadores
    playersCountSpan.textContent = Object.keys(players).length;

    // Actualizar o agregar otros jugadores
    for (const id in players) {
        if (id !== socket.id) {
            otherPlayers[id] = players[id];
        } else {
            player.name = players[id].name; // Actualizar nombre propio
        }
    }

    // Eliminar jugadores que se desconectaron
    for (const id in otherPlayers) {
        if (!players[id]) {
            delete otherPlayers[id];
        }
    }
});

// Actualización de enemies
socket.on('updateEnemies', (updatedEnemies) => {
    enemies = updatedEnemies;
});

// Jugador muerto
socket.on('playerDied', (data) => {
    if (data.playerId === socket.id) {
        explosionSound.play();
        player.dead = true;
        playerX = -100; // Ocultar fuera de pantalla
        playerY = -100;
    }
});

// Jugador respawnea
socket.on('playerRespawned', (data) => {
    if (data.playerId === socket.id) {
        player.dead = false;
        playerX = data.x;
        playerY = data.y;
    }
});

// Actualización de vidas de la sala
socket.on('roomLivesUpdate', (lives) => {
    roomLivesSpan.textContent = lives;
});

// Actualización de naves destruidas
socket.on('shipsDestroyedUpdate', (count) => {
    shipsDestroyedSpan.textContent = count;
    enemyKillSound.play(); // Play enemy kill sound
});

// Stage transition
socket.on('stageTransition', (data) => {
    currentStageSpan.textContent = data.stage;
    stageNumberSpan.textContent = data.stage;
    stageDisplay.style.display = 'block';
    canvas.style.borderColor = 'yellow';

    // Change background image based on stage
    if (data.stage === 2) {
        bgImg.src = 'bg2.jpg';
    } else if (data.stage === 3) {
        bgImg.src = 'bg3.png';
    } else if (data.stage === 4) {
        bgImg.src = 'bg4.png';
    }

    // Stop current music and start new stage music
    if (data.stage === 2) {
        stage1Music.pause();
        stage1Music.currentTime = 0;
        if (musicToggle.checked) stage2Music.play();
    } else if (data.stage === 3) {
        stage2Music.pause();
        stage2Music.currentTime = 0;
        if (musicToggle.checked) stage3Music.play();
    } else if (data.stage === 4) {
        stage3Music.pause();
        stage3Music.currentTime = 0;
        if (musicToggle.checked) stage4Music.play();
    }

    setTimeout(() => {
        stageDisplay.style.display = 'none';
        canvas.style.borderColor = 'gray';
    }, 2000);
});

// Game over
socket.on('gameOver', () => {
    loseSound.play();
    alert('Game Over! La sala se reiniciará.');
});

// Evento para cambiar nombre
changeNameBtn.addEventListener('click', () => {
    const newName = nameInput.value.trim();
    if (newName) {
        socket.emit('changeName', newName);
        nameInput.value = '';
    }
});

// Audio controls
musicToggle.addEventListener('change', () => {
    if (musicToggle.checked) {
        // Resume music based on current stage
        const currentStage = parseInt(currentStageSpan.textContent);
        if (currentStage === 1) stage1Music.play();
        else if (currentStage === 2) stage2Music.play();
        else if (currentStage === 3) stage3Music.play();
        else if (currentStage === 4) stage4Music.play();
    } else {
        // Pause all music
        stage1Music.pause();
        stage2Music.pause();
        stage3Music.pause();
        stage4Music.pause();
    }
});

sfxToggle.addEventListener('change', () => {
    // SFX volume control - for simplicity, we'll just mute/unmute all SFX
    const volume = sfxToggle.checked ? 1 : 0;
    explosionSound.volume = volume;
    loseSound.volume = volume;
    enemyKillSound.volume = volume;
    kidesSound.volume = volume;
});

// Bala impactó
socket.on('bulletHit', (bulletId) => {
    bullets = bullets.filter(bullet => bullet.id !== bulletId);
});

// Spawn power-up
socket.on('spawnPowerUp', (powerUpData) => {
    const powerUpId = `powerup_${powerUpIdCounter++}`;
    powerUps.push({
        id: powerUpId,
        type: powerUpData.type,
        x: powerUpData.x,
        y: powerUpData.y,
        spawnTime: powerUpData.spawnTime
    });
});

// Bucle principal del juego
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar fondo
    ctx.save();
    ctx.filter = 'brightness(0.5)';
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Disparos automáticos si no está muerto
    if (!player.dead && Date.now() - lastShootTime > shootInterval) {
        let bulletCount = 1;
        let bulletColor = 'normal'; // 'normal', 'green', 'blue'

        if (powerUpEffect === 'double' && Date.now() < powerUpEndTime) {
            bulletCount = 2;
            bulletColor = 'green';
        } else if (powerUpEffect === 'triple' && Date.now() < powerUpEndTime) {
            bulletCount = 3;
            bulletColor = 'blue';
        } else {
            powerUpEffect = null; // Reset if expired
        }

        for (let i = 0; i < bulletCount; i++) {
            const bulletId = `bullet_${bulletIdCounter++}`;
            let bulletX = playerX + 12;
            if (bulletCount === 2) {
                bulletX += (i === 0 ? -4 : 4); // Offset for double bullets
            } else if (bulletCount === 3) {
                bulletX += (i === 0 ? -8 : i === 1 ? 0 : 8); // Offset for triple bullets
            }
            const bullet = { id: bulletId, x: bulletX, y: playerY, speed: 10, color: bulletColor };
            bullets.push(bullet);
            socket.emit('playerShoot', bullet);
        }
        lastShootTime = Date.now();
    }

    // Mover balas y verificar colisiones
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;

        // Verificar colisión con enemies
        let hit = false;
        for (const enemyId in enemies) {
            const enemy = enemies[enemyId];
            if (bullets[i].x < enemy.x + 32 && bullets[i].x + 8 > enemy.x &&
                bullets[i].y < enemy.y + 32 && bullets[i].y + 16 > enemy.y) {
                hit = true;
                socket.emit('bulletHit', { bulletId: bullets[i].id, enemyId });
                break;
            }
        }

        if (hit || bullets[i].y < 0) {
            bullets.splice(i, 1);
        }
    }

    // Mover jugador si no está muerto
    if (!player.dead) {
        if (keys['ArrowLeft'] || keys['a']) playerX -= playerSpeed;
        if (keys['ArrowRight'] || keys['d']) playerX += playerSpeed;
        if (keys['ArrowUp'] || keys['w']) playerY -= playerSpeed;
        if (keys['ArrowDown'] || keys['s']) playerY += playerSpeed;

        // Mantener dentro de los límites
        playerX = Math.max(0, Math.min(canvas.width - 32, playerX));
        playerY = Math.max(0, Math.min(canvas.height - 32, playerY));
    }

    // Actualizar objeto jugador
    player.x = playerX;
    player.y = playerY;

    // Dibujar balas
    for (const bullet of bullets) {
        ctx.save();
        if (bullet.color === 'green') {
            ctx.filter = 'hue-rotate(120deg)'; // Verde
        } else if (bullet.color === 'blue') {
            ctx.filter = 'hue-rotate(240deg)'; // Azul
        }
        ctx.drawImage(bulletImg, bullet.x, bullet.y, 16, 32);
        ctx.restore();
    }

    // Dibujar enemies
    for (const enemyId in enemies) {
        const enemy = enemies[enemyId];
        ctx.save();
        if (enemy.type === 'fast') {
            ctx.filter = 'hue-rotate(180deg)'; // Filtro celeste
        } else if (enemy.type === 'red') {
            ctx.filter = 'hue-rotate(0deg) saturate(2)'; // Filtro rojo
        } else {
            ctx.filter = 'grayscale(100%)';
        }
        ctx.translate(enemy.x + 16, enemy.y + 16);
        ctx.rotate(Math.PI);
        const img = enemy.type === 'red' ? ship2Img : playerImg;
        ctx.drawImage(img, -32, -32, 64, 64);
        ctx.restore();

        // Barra de vida
        const maxHp = enemy.type === 'red' ? 9 : 5;
        ctx.fillStyle = 'red';
        ctx.fillRect(enemy.x, enemy.y - 10, 32, 5);
        ctx.fillStyle = 'green';
        ctx.fillRect(enemy.x, enemy.y - 10, (enemy.hp / maxHp) * 32, 5);
    }

    // Dibujar jugador si no está muerto
    if (!player.dead) {
        ctx.drawImage(playerImg, player.x - 16, player.y - 16, 64, 64);
        // Dibujar nombre
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, player.x + 16, player.y - 20);
    }

    // Dibujar otros jugadores
    for (const id in otherPlayers) {
        const p = otherPlayers[id];
        if (!p.dead) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.drawImage(playerImg, p.x - 16, p.y - 16, 64, 64);
            ctx.restore();
            // Dibujar nombre
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, p.x + 16, p.y - 20);
        }
    }

    // Dibujar power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        ctx.fillStyle = powerUp.type === 'double' ? 'green' : 'blue';
        ctx.fillRect(powerUp.x, powerUp.y, 16, 16);

        // Verificar colisión con jugador
        if (!player.dead && player.x < powerUp.x + 16 && player.x + 32 > powerUp.x &&
            player.y < powerUp.y + 16 && player.y + 32 > powerUp.y) {
            powerUpEffect = powerUp.type;
            powerUpEndTime = Date.now() + 15000; // 15 segundos
            powerUps.splice(i, 1);
            continue;
        }

        // Eliminar power-up si no se recoge en 7 segundos
        if (Date.now() - powerUp.spawnTime > 7000) {
            powerUps.splice(i, 1);
        }
    }

    // Enviar posición al servidor si no está muerto
    if (!player.dead) {
        socket.emit('playerPosition', { x: player.x, y: player.y });
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
