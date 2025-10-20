const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configuración de Socket.IO con CORS
const io = new Server(server, {
  cors: {
    origin: '*', // Permite cualquier origen (útil para desarrollo local)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }
});

// Guardar jugadores
const players = {};
let enemies = {};
const bullets = [];
let enemyIdCounter = 0;
let lastEnemySpawn = Date.now();
let lastFastEnemySpawn = Date.now();
let lastRedEnemySpawn = Date.now();
const enemySpawnInterval = 3000; // 3 segundos
const fastEnemySpawnInterval = 5000; // 5 segundos
const redEnemySpawnInterval = 10000; // 10 segundos
const enemySpeed = 1; // Velocidad de bajada
const fastEnemySpeed = 1.3; // 30% más rápido
const redEnemySpeed = 0.7; // 30% más lento
const playerRespawnTime = 5000; // 5 segundos
let roomLives = 10; // Vidas de la sala
let shipsDestroyed = 0; // Naves destruidas totales
let currentStage = 1;
const stageGoals = [100, 220, 350, Infinity];
const stageConfigs = [
  { gray: 4000, fast: 7000, red: 13000 },
  { gray: 4000, fast: 6000, red: 11000 },
  { gray: 3000, fast: 6000, red: 10000 },
  { gray: 3000, fast: 5000, red: 9000 }
];
let stageTransitionTime = 0; // Time when stage transition started

function generateId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);

  // Nuevo jugador
  socket.on('newPlayer', (playerData) => {
    if (Object.keys(players).length >= 12) {
      // Sala llena, redirigir a página de "game full"
      socket.emit('gameFull');
      return;
    }
    players[socket.id] = {
      x: playerData.x || Math.floor(Math.random() * 800),
      y: playerData.y || Math.floor(Math.random() * 600),
      name: `Guest_${generateId()}`
    };
    io.emit('updatePlayers', players);
  });

  // Actualización de posición
  socket.on('playerPosition', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      io.emit('updatePlayers', players);
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });

  // Disparos del jugador
  socket.on('playerShoot', (bulletData) => {
    // Verificar colisiones con enemies
    for (const enemyId in enemies) {
      const enemy = enemies[enemyId];
      if (bulletData.x < enemy.x + 32 && bulletData.x + 8 > enemy.x &&
          bulletData.y < enemy.y + 32 && bulletData.y + 16 > enemy.y) {
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          delete enemies[enemyId];
        }
        io.emit('updateEnemies', enemies);
        io.emit('bulletHit', bulletData.id); // Notificar al cliente que la bala impactó
        return; // Bala impacta solo a un enemy
      }
    }
  });

  // Bala impactó (desde cliente)
  socket.on('bulletHit', (data) => {
    const { bulletId, enemyId } = data;
    if (enemies[enemyId]) {
      enemies[enemyId].hp -= 1;
      if (enemies[enemyId].hp <= 0) {
        const enemyType = enemies[enemyId].type;
        const enemyX = enemies[enemyId].x;
        const enemyY = enemies[enemyId].y;
        delete enemies[enemyId];
        shipsDestroyed += 1;
        io.emit('shipsDestroyedUpdate', shipsDestroyed);

        // Power-up drop for normal enemies
        if (enemyType === 'normal') {
          const rand = Math.random();
          if (rand < 0.05) { // 5% green ball
            io.emit('spawnPowerUp', { type: 'double', x: enemyX, y: enemyY, spawnTime: Date.now() });
          } else if (rand < 0.06) { // 1% blue ball (additional 1%)
            io.emit('spawnPowerUp', { type: 'triple', x: enemyX, y: enemyY, spawnTime: Date.now() });
          }
        }

        // Check for stage progression
        if (currentStage < 4 && shipsDestroyed >= stageGoals[currentStage - 1]) {
          currentStage++;
          stageTransitionTime = Date.now();
          enemies = {}; // Clear all enemies
          roomLives += 3; // Add 3 extra lives on stage progression
          io.emit('roomLivesUpdate', roomLives);
          io.emit('stageTransition', { stage: currentStage, transitionTime: stageTransitionTime });
        }
      }
      io.emit('updateEnemies', enemies);
    }
  });

  // Cambiar nombre
  socket.on('changeName', (newName) => {
    if (players[socket.id]) {
      players[socket.id].name = newName;
      io.emit('updatePlayers', players);
    }
  });
});

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static('.'));

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

// Bucle del juego para enemies y colisiones
setInterval(() => {
  const config = stageConfigs[currentStage - 1];

  // Spawn enemies only if not in transition
  if (Date.now() - stageTransitionTime > 2000) {
    // Spawn enemies
    if (Date.now() - lastEnemySpawn > config.gray) {
      const enemyId = `enemy_${enemyIdCounter++}`;
      enemies[enemyId] = {
      x: Math.floor(Math.random() * (600 - 32)),
        y: -32,
        hp: 5,
        type: 'normal'
      };
      lastEnemySpawn = Date.now();
    }

    // Spawn fast enemies
    if (Date.now() - lastFastEnemySpawn > config.fast) {
      const enemyId = `enemy_${enemyIdCounter++}`;
      enemies[enemyId] = {
      x: Math.floor(Math.random() * (600 - 32)),
        y: -32,
        hp: 5,
        type: 'fast'
      };
      lastFastEnemySpawn = Date.now();
    }

    // Spawn red enemies
    if (Date.now() - lastRedEnemySpawn > config.red) {
      const enemyId = `enemy_${enemyIdCounter++}`;
      enemies[enemyId] = {
      x: Math.floor(Math.random() * (600 - 32)),
        y: -32,
        hp: 9,
        type: 'red'
      };
      lastRedEnemySpawn = Date.now();
    }
  }

  // Mover enemies hacia abajo
  for (const enemyId in enemies) {
    if (!enemies[enemyId]) continue;
    const enemy = enemies[enemyId];
    let speed = enemySpeed;
    if (enemy.type === 'fast') speed = fastEnemySpeed;
    else if (enemy.type === 'red') speed = redEnemySpeed;
    enemy.y += speed;
    if (enemy.y > 600) {
      delete enemies[enemyId];
      roomLives -= 1; // Perder una vida si un enemy llega abajo
      io.emit('roomLivesUpdate', roomLives);
      if (roomLives <= 0) {
        // Game over
        io.emit('gameOver');
        // Reiniciar sala
        roomLives = 10;
        shipsDestroyed = 0; // Reiniciar contador de naves destruidas
        currentStage = 1;
        enemies = {}; // Limpiar enemies
        enemyIdCounter = 0;
        lastEnemySpawn = Date.now();
        lastFastEnemySpawn = Date.now();
        lastRedEnemySpawn = Date.now();
        stageTransitionTime = 0;
        // Respawn todos los jugadores en posición inicial
        for (const playerId in players) {
          players[playerId].dead = false;
          players[playerId].x = 300 - 16; // Centro horizontal
          players[playerId].y = 600 - 32; // Abajo
          io.emit('playerRespawned', { playerId, x: players[playerId].x, y: players[playerId].y });
        }
        io.emit('roomLivesUpdate', roomLives);
      }
    }
  }

  // Verificar colisiones enemy-jugador
  for (const playerId in players) {
    const player = players[playerId];
    if (player.dead) continue; // Si ya está muerto, saltar
    for (const enemyId in enemies) {
      const enemy = enemies[enemyId];
      if (!enemy) continue;
      if (player.x < enemy.x + 32 && player.x + 32 > enemy.x &&
          player.y < enemy.y + 32 && player.y + 32 > enemy.y) {
        // Colisión: eliminar enemy, matar jugador
        delete enemies[enemyId];
        player.dead = true;
        player.respawnTime = Date.now() + playerRespawnTime;
        io.emit('playerDied', { playerId, respawnTime: player.respawnTime });
        break;
      }
    }
  }

  // Respawn jugadores
  for (const playerId in players) {
    const player = players[playerId];
    if (player.dead && Date.now() > player.respawnTime) {
      player.dead = false;
      player.x = 300 - 16; // Centro horizontal
      player.y = 600 - 32; // Abajo
      io.emit('playerRespawned', { playerId, x: player.x, y: player.y });
    }
  }

  // Emitir updates de enemies
  io.emit('updateEnemies', enemies);
}, 1000 / 60); // 60 FPS
