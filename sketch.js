/* =========================================================================
   PURIFICADOR DE SOLOS - CONTROLO DE ESPÉCIES INVASORAS (VISTA AÉREA Top-Down)
   Unidade Curricular: Sistemas Multimédia (EX. Prático)
   Autor: Luís Martinho Oliveira Lopes (Nº 25361) | Sigla: ECGM
   Tema: Sustentabilidade e Ambiente (Controlo de Espécies Invasoras)
   ========================================================================= */

// --- ESTADOS DO JOGO ---
const STATE_START = 0;
const STATE_CALIBRATE = 1;
const STATE_PLAY = 2;
const STATE_GAMEOVER = 3;

let gameState = STATE_START;

// --- ÁUDIO & CONTROLO POR MICROFONE (COM HISTERESE) ---
let mic;
let micLevel = 0;
let ambientLevel = 0.02;
let highThreshold = 0.15; // Limite superior para disparo
let lowThreshold = 0.07;  // Limite inferior para reinício (Histerese)
let canFireAudio = true;  // Controlo da histerese

// Variáveis de Calibração
let calibFrames = 0;
const MAX_CALIB_FRAMES = 180; // 3 segundos a 60 FPS
let calibSum = 0;

// --- SINTETIZADOR DE SOM (Web Audio API) ---
let audioCtx;

function initAudioSynth() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'laser') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.18);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (type === 'hit_invasive') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (type === 'hit_native') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(90, now + 0.12);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
    osc.start(now);
    osc.stop(now + 0.32);
  } else if (type === 'combo') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
    osc.start(now);
    osc.stop(now + 0.55);
  }
}

// --- VARIÁVEIS DO JOGO ---
let score = 0;
let lives = 3;
let purifiedCount = 0;
let nativeHitsCount = 0;
let maxComboAchieved = 0;

let plants = [];
let particles = [];
let laserAnim = null; // Efeito gráfico de raio laser orbital

let spawnTimer = 0;
let spawnInterval = 75; // Frames entre germinação de plantas no mapa aéreo

// --- SISTEMA DE COMBOS DE PURIFICAÇÃO (Funcionalidade Original) ---
// 3 invasoras consecutivas em < 5 segundos = Bónus de Raio de Destruição
let recentInvasiveTimestamps = [];
let hasComboBonus = false;
const COMBO_TIME_WINDOW = 5000; // 5 segundos
const NORMAL_LASER_RADIUS = 45;
const BOOSTED_LASER_RADIUS = 105;

// --- CLASSE PLANTA (VISTA AÉREA TOP-DOWN) ---
class Plant {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'INVASIVE' (Chorão-das-praias) ou 'NATIVE' (Flora Nativa)
    this.size = 0;
    this.targetSize = type === 'INVASIVE' ? random(50, 70) : random(40, 55);
    this.growthSpeed = random(0.8, 1.3);
    this.alive = true;
    this.age = 0;
    this.maxAge = type === 'INVASIVE' ? 450 : 650;
    this.rotation = random(TWO_PI);
  }

  update() {
    if (this.size < this.targetSize) {
      this.size += this.growthSpeed;
    }
    this.age++;
    if (this.age > this.maxAge) {
      this.alive = false;
    }
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);

    if (this.type === 'INVASIVE') {
      // --- ESPÉCIE INVASORA: CHORÃO-DAS-PRAIAS (Vista Aérea Top-Down) ---
      // Folhas suculentas triangulares espalhadas em 360°
      stroke(20, 83, 45);
      strokeWeight(2);
      fill(34, 197, 94);

      let leafCount = 10;
      for (let i = 0; i < leafCount; i++) {
        let angle = (TWO_PI / leafCount) * i + sin(frameCount * 0.04 + this.x) * 0.05;
        push();
        rotate(angle);
        triangle(0, 0, -this.size * 0.22, -this.size * 0.65, this.size * 0.22, -this.size * 0.65);
        pop();
      }

      // Centro com flor rosa/magenta vibrante
      fill(236, 72, 153);
      noStroke();
      let petalCount = 14;
      for (let i = 0; i < petalCount; i++) {
        let angle = (TWO_PI / petalCount) * i;
        push();
        rotate(angle);
        ellipse(0, -this.size * 0.3, this.size * 0.16, this.size * 0.4);
        pop();
      }
      fill(250, 204, 21);
      circle(0, 0, this.size * 0.28);

      // Aura de alerta ecológico
      noFill();
      stroke(239, 68, 68, 130 + sin(frameCount * 0.1) * 70);
      strokeWeight(1.5);
      ellipse(0, 0, this.size * 1.25, this.size * 1.25);

    } else {
      // --- ESPÉCIE NATIVA: FLORA NATIVA (Vista Aérea Top-Down) ---
      // Folhas de base verdes
      fill(22, 163, 74);
      noStroke();
      for (let i = 0; i < 5; i++) {
        push();
        rotate((TWO_PI / 5) * i);
        ellipse(0, -this.size * 0.35, this.size * 0.25, this.size * 0.5);
        pop();
      }

      // Pétalas de margarida suave delicadas
      fill(255, 255, 255);
      let petalCount = 8;
      for (let i = 0; i < petalCount; i++) {
        let angle = (TWO_PI / petalCount) * i + sin(frameCount * 0.03 + this.y) * 0.06;
        push();
        rotate(angle);
        ellipse(0, -this.size * 0.4, this.size * 0.28, this.size * 0.48);
        pop();
      }

      // Centro dourado saudável
      fill(245, 158, 11);
      circle(0, 0, this.size * 0.32);

      // Aura protetora verde suave
      noFill();
      stroke(52, 211, 153, 110);
      strokeWeight(1);
      circle(0, 0, this.size * 1.15);
    }

    pop();
  }
}

// --- CLASSE PARTÍCULA ---
class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.vx = random(-4.5, 4.5);
    this.vy = random(-4.5, 4.5);
    this.alpha = 255;
    this.col = col;
    this.size = random(4, 9);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.alpha -= 7;
  }

  draw() {
    push();
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), this.alpha);
    circle(this.x, this.y, this.size);
    pop();
  }
}

// --- CONFIGURAÇÃO INICIAL (SETUP) ---
function setup() {
  let canvas = createCanvas(900, 600);
  canvas.parent('game-container');
  textFont('Segoe UI');

  // Inicializar entrada de microfone p5.sound
  mic = new p5.AudioIn();
  mic.start();
}

// --- CICLO PRINCIPAL (DRAW) ---
function draw() {
  background(20, 27, 38); // Fundo escuro azul-noite de mapa terrestre

  // Obter nível atual do microfone
  if (mic) {
    micLevel = mic.getLevel();
  }

  switch (gameState) {
    case STATE_START:
      drawStartScreen();
      break;
    case STATE_CALIBRATE:
      drawCalibrateScreen();
      break;
    case STATE_PLAY:
      updateAndDrawPlayScreen();
      break;
    case STATE_GAMEOVER:
      drawGameOverScreen();
      break;
  }
}

// --- ECRÃ 1: INÍCIO E INSTRUÇÕES ---
function drawStartScreen() {
  drawTopDownTerrestrialBackground();

  push();
  fill(30, 41, 59, 235);
  stroke(51, 65, 85);
  strokeWeight(2);
  rect(90, 35, width - 180, height - 80, 16);

  textAlign(CENTER, TOP);
  fill(52, 211, 153);
  textSize(30);
  textStyle(BOLD);
  text("PURIFICADOR DE SOLOS (VISTA AÉREA)", width / 2, 55);

  fill(226, 232, 240);
  textSize(16);
  textStyle(NORMAL);
  text("Controlo de Espécies Invasoras em Mapa Top-Down", width / 2, 95);

  textAlign(LEFT, TOP);
  let startY = 130;
  textSize(14);
  fill(203, 213, 225);

  text("OBJETIVO DO EXERCÍCIO:", 120, startY);
  fill(241, 245, 249);
  text("• Assuma o papel de Purificador de Solos e elimine as espécies invasoras (Chorão-das-praias).", 130, startY + 22);
  text("• PRESERVE a flora nativa! Atingir plantas nativas faz perder vidas.", 130, startY + 42);

  fill(203, 213, 225);
  text("CONTROLOS MULTIMÉDIA (RATO + MICROFONE):", 120, startY + 75);
  fill(241, 245, 249);
  text("• Mira do Laser: Movimento do Rato sobre o mapa aéreo.", 130, startY + 97);
  text("• Disparo: Palma, Estalar de Dedos, Assobio ou Som Audível (Controlo por Histerese).", 130, startY + 117);
  text("  (Tecla [ESPAÇO] ou Clique no Rato funcionam como controlo de teste).", 130, startY + 137);

  fill(251, 191, 36);
  text("FUNCIONALIDADE ORIGINAL - COMBOS DE PURIFICAÇÃO:", 120, startY + 170);
  fill(241, 245, 249);
  text("• Elimine 3 plantas invasoras consecutivas em menos de 5 segundos para ativar o", 130, startY + 192);
  text("  SUPER LASER com o dobro do raio de destruição no próximo disparo!", 130, startY + 210);

  // Botão de Iniciar Calibração
  let btnX = width / 2 - 130;
  let btnY = 470;
  let btnW = 260;
  let btnH = 50;

  let isHover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
  fill(isHover ? color(16, 185, 129) : color(5, 150, 105));
  stroke(52, 211, 153);
  strokeWeight(2);
  rect(btnX, btnY, btnW, btnH, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  textStyle(BOLD);
  text("INICIAR CALIBRAÇÃO", width / 2, btnY + btnH / 2);
  pop();

  drawFooterUI();
}

// --- ECRÃ DE CALIBRAÇÃO (MEDIR RUÍDO DE FUNDO) ---
function drawCalibrateScreen() {
  drawTopDownTerrestrialBackground();

  push();
  fill(30, 41, 59, 240);
  stroke(52, 211, 153);
  strokeWeight(2);
  rect(150, 120, width - 300, 340, 16);

  textAlign(CENTER, TOP);
  fill(52, 211, 153);
  textSize(26);
  textStyle(BOLD);
  text("CALIBRAÇÃO DE ÁUDIO EM CURSO", width / 2, 150);

  fill(226, 232, 240);
  textSize(16);
  textStyle(NORMAL);
  text("Mantenha o ambiente em silêncio para captar o ruído de fundo...", width / 2, 195);

  calibFrames++;
  calibSum += micLevel;

  let progress = calibFrames / MAX_CALIB_FRAMES;
  fill(51, 65, 85);
  rect(200, 240, width - 400, 24, 12);
  fill(16, 185, 129);
  rect(200, 240, (width - 400) * progress, 24, 12);

  fill(203, 213, 225);
  textSize(14);
  text(`Ruído Amostrado: ${(micLevel * 100).toFixed(1)}%`, width / 2, 280);

  if (calibFrames >= MAX_CALIB_FRAMES) {
    ambientLevel = calibSum / MAX_CALIB_FRAMES;
    highThreshold = constrain(ambientLevel * 3.2 + 0.10, 0.12, 0.85);
    lowThreshold = highThreshold * 0.45;
    
    gameState = STATE_PLAY;
    resetGameData();
  }
  pop();

  drawFooterUI();
}

// --- ECRÃ 2: EXECUÇÃO (JOGO JOGÁVEL EM VISTA AÉREA) ---
function updateAndDrawPlayScreen() {
  drawTopDownTerrestrialBackground();

  // --- SPAWN ALEATÓRIO DE PLANTAS EM TODO O TERRENO ---
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    // Posições no mapa aéreo (evitando apenas a barra HUD no topo)
    let spawnX = random(60, width - 60);
    let spawnY = random(85, height - 60);
    let plantType = random() < 0.65 ? 'INVASIVE' : 'NATIVE';
    plants.push(new Plant(spawnX, spawnY, plantType));

    if (spawnInterval > 40) spawnInterval -= 0.5;
  }

  // --- ATUALIZAR E DESENHAR PLANTAS ---
  for (let i = plants.length - 1; i >= 0; i--) {
    let p = plants[i];
    p.update();
    p.draw();

    if (!p.alive) {
      plants.splice(i, 1);
    }
  }

  // --- ATUALIZAR E DESENHAR PARTÍCULAS ---
  for (let i = particles.length - 1; i >= 0; i--) {
    let pt = particles[i];
    pt.update();
    pt.draw();
    if (pt.alpha <= 0) particles.splice(i, 1);
  }

  // --- LÓGICA DE DISPARO DE ÁUDIO COM HISTERESE ---
  checkAudioHysteresis();

  // --- ANIMAÇÃO VISUAL DO LASER ORBITAL ---
  if (laserAnim) {
    drawLaserBlast(laserAnim.x, laserAnim.y, laserAnim.radius, laserAnim.isBoosted);
    laserAnim.life--;
    if (laserAnim.life <= 0) laserAnim = null;
  }

  if (lives <= 0) {
    gameState = STATE_GAMEOVER;
  }

  drawPlayHUD();
  drawCrosshair(mouseX, mouseY);
  drawFooterUI();
}

// --- LÓGICA DE DISPARO POR ÁUDIO (HISTERESE) ---
function checkAudioHysteresis() {
  if (micLevel >= highThreshold && canFireAudio) {
    triggerLaserShot(mouseX, mouseY);
    canFireAudio = false; // Tranca a histerese
  }

  if (micLevel < lowThreshold) {
    canFireAudio = true; // Reinicia gatilho
  }
}

// --- GATILHO DE DISPARO DO LASER ---
function triggerLaserShot(targetX, targetY) {
  initAudioSynth();
  playSound('laser');

  let now = millis();
  recentInvasiveTimestamps = recentInvasiveTimestamps.filter(t => now - t <= COMBO_TIME_WINDOW);

  let currentRadius = hasComboBonus ? BOOSTED_LASER_RADIUS : NORMAL_LASER_RADIUS;
  let isBoostedShot = hasComboBonus;

  laserAnim = { x: targetX, y: targetY, radius: currentRadius, life: 14, isBoosted: isBoostedShot };

  if (hasComboBonus) {
    hasComboBonus = false;
  }

  for (let i = plants.length - 1; i >= 0; i--) {
    let p = plants[i];
    let d = dist(targetX, targetY, p.x, p.y);

    if (d <= currentRadius + p.size / 2) {
      if (p.type === 'INVASIVE') {
        score += 10;
        purifiedCount++;
        createExplosion(p.x, p.y, color(52, 211, 153));
        playSound('hit_invasive');
        recentInvasiveTimestamps.push(now);
      } else if (p.type === 'NATIVE') {
        lives--;
        nativeHitsCount++;
        recentInvasiveTimestamps = [];
        createExplosion(p.x, p.y, color(239, 68, 68));
        playSound('hit_native');
      }
      plants.splice(i, 1);
    }
  }

  if (recentInvasiveTimestamps.length >= 3) {
    hasComboBonus = true;
    recentInvasiveTimestamps = [];
    maxComboAchieved++;
    playSound('combo');
  }
}

function keyPressed() {
  if (key === ' ' && gameState === STATE_PLAY) {
    triggerLaserShot(mouseX, mouseY);
  }
}

function mousePressed() {
  initAudioSynth();
  if (gameState === STATE_START) {
    let btnX = width / 2 - 130;
    let btnY = 470;
    let btnW = 260;
    let btnH = 50;
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      gameState = STATE_CALIBRATE;
      calibFrames = 0;
      calibSum = 0;
    }
  } else if (gameState === STATE_PLAY) {
    triggerLaserShot(mouseX, mouseY);
  } else if (gameState === STATE_GAMEOVER) {
    let btnX = width / 2 - 120;
    let btnY = 440;
    let btnW = 240;
    let btnH = 50;
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      gameState = STATE_PLAY;
      resetGameData();
    }
  }
}

function createExplosion(x, y, col) {
  for (let i = 0; i < 18; i++) {
    particles.push(new Particle(x, y, col));
  }
}

// --- DESENHAR IMPACTO DO LASER (VISTA AÉREA) ---
function drawLaserBlast(x, y, radius, isBoosted) {
  push();
  // Raio laser vertical vindo do espaço orbital
  strokeWeight(isBoosted ? 16 : 8);
  stroke(isBoosted ? color(251, 191, 36, 230) : color(56, 189, 248, 230));
  line(x, y - 300, x, y);

  // Anéis concêntricos de explosão no chão
  fill(isBoosted ? color(251, 191, 36, 120) : color(56, 189, 248, 90));
  stroke(isBoosted ? color(251, 191, 36) : color(56, 189, 248));
  strokeWeight(3);
  circle(x, y, radius * 2);
  circle(x, y, radius * 1.2);
  pop();
}

// --- DESENHAR MIRA TOP-DOWN ---
function drawCrosshair(x, y) {
  push();
  translate(x, y);

  let isBoost = hasComboBonus;
  stroke(isBoost ? color(251, 191, 36) : color(239, 68, 68));
  strokeWeight(2);
  noFill();

  // Anéis de mira
  circle(0, 0, isBoost ? 50 : 32);
  circle(0, 0, isBoost ? 24 : 16);

  // Retículo central
  line(-22, 0, -10, 0);
  line(10, 0, 22, 0);
  line(0, -22, 0, -10);
  line(0, 10, 0, 22);

  fill(isBoost ? color(251, 191, 36) : color(239, 68, 68));
  circle(0, 0, 4);

  if (isBoost) {
    textAlign(CENTER, BOTTOM);
    textSize(11);
    textStyle(BOLD);
    fill(251, 191, 36);
    text("SUPER LASER AÉREO PRONTO!", 0, -28);
  }
  pop();
}

// --- INTERFACE HUD DE JOGO ---
function drawPlayHUD() {
  push();
  fill(15, 23, 42, 225);
  noStroke();
  rect(0, 0, width, 55);

  textAlign(LEFT, CENTER);
  textSize(18);
  textStyle(BOLD);
  fill(52, 211, 153);
  text(`Pontuação: ${score}`, 20, 28);

  fill(239, 68, 68);
  let heartStr = "♥ ".repeat(max(0, lives));
  text(`Vidas: ${heartStr}`, 200, 28);

  fill(251, 191, 36);
  textSize(14);
  if (hasComboBonus) {
    text("COMBO ACTIVADO! (Raio Extra no próximo disparo)", 350, 28);
  } else {
    let recentHits = recentInvasiveTimestamps.length;
    fill(148, 163, 184);
    text(`Combo Sequência: ${recentHits}/3 (< 5s)`, 350, 28);
  }

  // Vu-Metro com Histerese
  let meterX = width - 210;
  let meterY = 18;
  let meterW = 180;
  let meterH = 18;

  fill(30, 41, 59);
  stroke(71, 85, 105);
  strokeWeight(1);
  rect(meterX, meterY, meterW, meterH, 6);

  let fillW = constrain(micLevel * meterW * 2.5, 0, meterW);
  fill(canFireAudio ? color(16, 185, 129) : color(245, 158, 11));
  noStroke();
  rect(meterX, meterY, fillW, meterH, 6);

  let highLineX = meterX + constrain(highThreshold * meterW * 2.5, 0, meterW);
  let lowLineX = meterX + constrain(lowThreshold * meterW * 2.5, 0, meterW);

  stroke(239, 68, 68);
  strokeWeight(2);
  line(highLineX, meterY - 2, highLineX, meterY + meterH + 2);

  stroke(251, 191, 36);
  line(lowLineX, meterY - 2, lowLineX, meterY + meterH + 2);

  textAlign(CENTER, TOP);
  textSize(10);
  fill(148, 163, 184);
  noStroke();
  text("Palma / Assobio / Estalo & Histerese", meterX + meterW / 2, meterY + meterH + 4);
  pop();
}

// --- ECRÃ 3: RESULTADO / REPETIR (GAME OVER) ---
function drawGameOverScreen() {
  drawTopDownTerrestrialBackground();

  push();
  fill(30, 41, 59, 240);
  stroke(239, 68, 68);
  strokeWeight(2);
  rect(140, 70, width - 280, 460, 16);

  textAlign(CENTER, TOP);
  fill(239, 68, 68);
  textSize(32);
  textStyle(BOLD);
  text("EXERCÍCIO CONCLUÍDO", width / 2, 95);

  fill(226, 232, 240);
  textSize(16);
  textStyle(NORMAL);
  text("Relatório de Purificação do Solo Aéreo", width / 2, 140);

  textAlign(LEFT, TOP);
  let statY = 190;
  textSize(16);
  fill(203, 213, 225);

  text(`• Pontuação Final:`, 200, statY);
  fill(52, 211, 153);
  textStyle(BOLD);
  text(`${score} pontos`, 400, statY);

  fill(203, 213, 225);
  textStyle(NORMAL);
  text(`• Espécies Invasoras Purificadas:`, 200, statY + 35);
  fill(241, 245, 249);
  text(`${purifiedCount}`, 450, statY + 35);

  fill(203, 213, 225);
  text(`• Danos em Espécies Nativas:`, 200, statY + 70);
  fill(239, 68, 68);
  text(`${nativeHitsCount}`, 450, statY + 70);

  fill(203, 213, 225);
  text(`• Combos de Purificação Ativados:`, 200, statY + 105);
  fill(251, 191, 36);
  text(`${maxComboAchieved}`, 450, statY + 105);

  let btnX = width / 2 - 120;
  let btnY = 440;
  let btnW = 240;
  let btnH = 50;

  let isHover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
  fill(isHover ? color(59, 130, 246) : color(37, 99, 235));
  stroke(96, 165, 250);
  strokeWeight(2);
  rect(btnX, btnY, btnW, btnH, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  textStyle(BOLD);
  text("REPETIR EXERCÍCIO", width / 2, btnY + btnH / 2);
  pop();

  drawFooterUI();
}

// --- DESENHO DE TERRENO EM VISTA AÉREA (TOP-DOWN MAP) ---
function drawTopDownTerrestrialBackground() {
  // Solo fértil com textura de relva/terra vista de cima
  background(20, 35, 28);

  // Grelha suave de textura terrestre
  stroke(28, 48, 38);
  strokeWeight(1);
  for (let x = 0; x < width; x += 50) {
    line(x, 0, x, height);
  }
  for (let y = 0; y < height; y += 50) {
    line(0, y, width, y);
  }

  // Detalhes estáticos de pedras e manchas de solo
  noStroke();
  fill(15, 28, 22, 120);
  ellipse(150, 200, 180, 140);
  ellipse(700, 420, 220, 160);
  ellipse(400, 500, 150, 110);
}

// --- TEXTOS DO RODAPÉ (EXIGÊNCIA RIGOROSA DO REQUISITO) ---
function drawFooterUI() {
  push();
  textSize(13);
  textStyle(BOLD);

  // Canto Inferior Esquerdo: Tema em Inglês
  textAlign(LEFT, BOTTOM);
  fill(148, 163, 184);
  text("Invasive Species Control", 15, height - 12);

  // Canto Inferior Direito: Nome, Número de Aluno e Sigla
  textAlign(RIGHT, BOTTOM);
  fill(52, 211, 153);
  text("Luís Lopes, nº 25361, ECGM", width - 15, height - 12);
  pop();
}

// --- REINICIAR DADOS DO JOGO ---
function resetGameData() {
  score = 0;
  lives = 3;
  purifiedCount = 0;
  nativeHitsCount = 0;
  maxComboAchieved = 0;
  plants = [];
  particles = [];
  recentInvasiveTimestamps = [];
  hasComboBonus = false;
  spawnTimer = 0;
  spawnInterval = 75;
}
