/* =========================================================================
   PURIFICADOR DE SOLOS - CONTROLO DE ESPÉCIES INVASORAS
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
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'hit_invasive') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'hit_native') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'combo') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
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
let laserAnim = null; // Efeito gráfico do disparo

let spawnTimer = 0;
let spawnInterval = 90; // Frames entre nascimento de plantas

// --- SISTEMA DE COMBOS DE PURIFICAÇÃO (Funcionalidade Original) ---
// 3 invasoras consecutivas em < 5 segundos = Bónus de Raio de Destruição
let recentInvasiveTimestamps = [];
let hasComboBonus = false;
const COMBO_TIME_WINDOW = 5000; // 5000 ms = 5 segundos
const NORMAL_LASER_RADIUS = 40;
const BOOSTED_LASER_RADIUS = 95;

// --- CLASSE PLANTA ---
class Plant {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'INVASIVE' (Chorão-das-praias) ou 'NATIVE' (Flora Nativa)
    this.size = 0;
    this.targetSize = type === 'INVASIVE' ? random(45, 65) : random(35, 50);
    this.growthSpeed = random(0.8, 1.4);
    this.alive = true;
    this.age = 0;
    this.maxAge = type === 'INVASIVE' ? 420 : 600; // Tempo até murchar/desaparecer
    this.flowerColor = type === 'INVASIVE' ? color(236, 72, 153) : color(251, 191, 36);
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

    if (this.type === 'INVASIVE') {
      // --- PLANT INVASORA: CHORÃO-DAS-PRAIAS (Carpobrotus edulis) ---
      // Folhas suculentas e pontiagudas triangulares
      stroke(20, 83, 45);
      strokeWeight(2);
      fill(34, 197, 94);

      let leafCount = 8;
      for (let i = 0; i < leafCount; i++) {
        let angle = (TWO_PI / leafCount) * i + sin(frameCount * 0.05 + this.x) * 0.05;
        push();
        rotate(angle);
        triangle(0, 0, -this.size * 0.25, -this.size * 0.7, this.size * 0.25, -this.size * 0.7);
        pop();
      }

      // Flor central magenta vívida com pétalas finas
      fill(this.flowerColor);
      noStroke();
      let petalCount = 12;
      for (let i = 0; i < petalCount; i++) {
        let angle = (TWO_PI / petalCount) * i;
        push();
        rotate(angle);
        ellipse(0, -this.size * 0.35, this.size * 0.18, this.size * 0.45);
        pop();
      }
      fill(250, 204, 21);
      circle(0, 0, this.size * 0.3);

      // Aura de perigo / Invasão
      noFill();
      stroke(239, 68, 68, 120 + sin(frameCount * 0.1) * 80);
      strokeWeight(1.5);
      ellipse(0, 0, this.size * 1.2, this.size * 0.8);

    } else {
      // --- PLANTA NATIVA: FLORA NATIVA (Margarida / Alfazema Nativa) ---
      // Haste e folhas suaves
      stroke(21, 128, 61);
      strokeWeight(3);
      line(0, 0, 0, -this.size * 0.4);

      // Pétalas delicadas arredondadas
      noStroke();
      fill(255, 255, 255);
      let petalCount = 7;
      for (let i = 0; i < petalCount; i++) {
        let angle = (TWO_PI / petalCount) * i + sin(frameCount * 0.03 + this.x) * 0.08;
        push();
        rotate(angle);
        ellipse(0, -this.size * 0.45, this.size * 0.3, this.size * 0.5);
        pop();
      }

      // Centro dourado saudável
      fill(245, 158, 11);
      circle(0, -this.size * 0.45, this.size * 0.35);

      // Aura ecológica verde suave
      noFill();
      stroke(52, 211, 153, 100);
      strokeWeight(1);
      circle(0, -this.size * 0.45, this.size * 1.1);
    }

    pop();
  }
}

// --- CLASSE PARTÍCULA ---
class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.vx = random(-4, 4);
    this.vy = random(-5, 2);
    this.alpha = 255;
    this.col = col;
    this.size = random(4, 9);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15; // gravidade
    this.alpha -= 8;
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
  background(15, 23, 42); // Fundo escuro azul-noite moderno

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
  // Fundo com relva estilizada
  drawEnvironmentBackground();

  // Painel Central
  push();
  fill(30, 41, 59, 230);
  stroke(51, 65, 85);
  strokeWeight(2);
  rect(100, 40, width - 200, height - 90, 16);

  // Título do Exercício
  textAlign(CENTER, TOP);
  fill(52, 211, 153);
  textSize(30);
  textStyle(BOLD);
  text("PURIFICADOR DE SOLOS", width / 2, 60);

  fill(226, 232, 240);
  textSize(16);
  textStyle(NORMAL);
  text("Controlo de Espécies Vegetais Invasoras", width / 2, 100);

  // Instruções e Objetivos
  textAlign(LEFT, TOP);
  let startY = 135;
  textSize(14);
  fill(203, 213, 225);

  text("OBJETIVO DO EXERCÍCIO:", 130, startY);
  fill(241, 245, 249);
  text("• Assuma o papel de Purificador de Solos e elimine as espécies invasoras (Chorão-das-praias).", 140, startY + 22);
  text("• PRESERVE a flora nativa! Atingir plantas nativas faz perder vidas.", 140, startY + 42);

  fill(203, 213, 225);
  text("CONTROLO MULTIMÉDIA (RATO + MICROFONE):", 130, startY + 75);
  fill(241, 245, 249);
  text("• Mira do Laser: Movimento do Rato.", 140, startY + 97);
  text("• Disparo do Laser: Som audível ou Palmas no Microfone (com Calibração e Histerese).", 140, startY + 117);
  text("  (Tecla [ESPAÇO] ou Clique no Rato funcionam como controlo alternativo).", 140, startY + 137);

  fill(251, 191, 36);
  text("FUNCIONALIDADE ORIGINAL - COMBOS DE PURIFICAÇÃO:", 130, startY + 170);
  fill(241, 245, 249);
  text("• Elimine 3 plantas invasoras consecutivas em menos de 5 segundos para ativar o", 140, startY + 192);
  text("  LASER REFORÇADO com o dobro do raio de destruição no disparo seguinte!", 140, startY + 210);

  // Botão de Iniciar Calibração
  let btnX = width / 2 - 130;
  let btnY = 465;
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
  drawEnvironmentBackground();

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

  // Barra de Progresso de Calibração
  calibFrames++;
  calibSum += micLevel;

  let progress = calibFrames / MAX_CALIB_FRAMES;
  fill(51, 65, 85);
  rect(200, 240, width - 400, 24, 12);
  fill(16, 185, 129);
  rect(200, 240, (width - 400) * progress, 24, 12);

  // Nível instantâneo do mic
  fill(203, 213, 225);
  textSize(14);
  text(`Ruído Amostrado: ${(micLevel * 100).toFixed(1)}%`, width / 2, 280);

  // Quando termina a amostragem
  if (calibFrames >= MAX_CALIB_FRAMES) {
    ambientLevel = calibSum / MAX_CALIB_FRAMES;
    // Calcular limites com Histerese
    highThreshold = constrain(ambientLevel * 3.2 + 0.10, 0.12, 0.85);
    lowThreshold = highThreshold * 0.45;
    
    // Avançar para o jogo
    gameState = STATE_PLAY;
    resetGameData();
  }
  pop();

  drawFooterUI();
}

// --- ECRÃ 2: EXECUÇÃO (JOGO JOGÁVEL) ---
function updateAndDrawPlayScreen() {
  drawEnvironmentBackground();

  // --- LÓGICA DE GERMANAÇÃO DE PLANTAS ---
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    let spawnX = random(60, width - 60);
    let spawnY = height - 85;
    let plantType = random() < 0.65 ? 'INVASIVE' : 'NATIVE';
    plants.push(new Plant(spawnX, spawnY, plantType));

    // Aumentar ligeiramente a dificuldade com o tempo
    if (spawnInterval > 45) spawnInterval -= 0.5;
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

  // --- ANIMAÇÃO VISUAL DO LASER ---
  if (laserAnim) {
    drawLaserBeam(laserAnim.x, laserAnim.y, laserAnim.radius, laserAnim.isBoosted);
    laserAnim.life--;
    if (laserAnim.life <= 0) laserAnim = null;
  }

  // --- VERIFICAR CONDIÇÃO DE FIM DE JOGO ---
  if (lives <= 0) {
    gameState = STATE_GAMEOVER;
  }

  // --- INTERFACE DE JOGO (HUD NO TOPO) ---
  drawPlayHUD();

  // --- MIRA DO LASER SEGUINDO O RATO ---
  drawCrosshair(mouseX, mouseY);

  // --- TEXTOS OBRIGATÓRIOS DO ENUNCIADO ---
  drawFooterUI();
}

// --- LÓGICA DE DISPARO POR ÁUDIO (HISTERESE) ---
function checkAudioHysteresis() {
  // Disparo quando excede o limite superior (High Threshold)
  if (micLevel >= highThreshold && canFireAudio) {
    triggerLaserShot(mouseX, mouseY);
    canFireAudio = false; // Tranca a histerese para evitar múltiplos disparos no mesmo som
  }

  // Reinício do gatilho apenas quando cai abaixo do limite inferior (Low Threshold)
  if (micLevel < lowThreshold) {
    canFireAudio = true;
  }
}

// --- GATILHO DE DISPARO DO LASER ---
function triggerLaserShot(targetX, targetY) {
  initAudioSynth();
  playSound('laser');

  // Limpar timestamps antigos do combo (mais de 5 segundos)
  let now = millis();
  recentInvasiveTimestamps = recentInvasiveTimestamps.filter(t => now - t <= COMBO_TIME_WINDOW);

  // Determinar raio de destruição
  let currentRadius = hasComboBonus ? BOOSTED_LASER_RADIUS : NORMAL_LASER_RADIUS;
  let isBoostedShot = hasComboBonus;

  // Animação do raio laser
  laserAnim = { x: targetX, y: targetY, radius: currentRadius, life: 12, isBoosted: isBoostedShot };

  // Consumir bónus de combo se usado
  if (hasComboBonus) {
    hasComboBonus = false;
  }

  let hitInvasiveThisShot = false;

  // Processar colisões com a área de impacto do laser
  for (let i = plants.length - 1; i >= 0; i--) {
    let p = plants[i];
    let d = dist(targetX, targetY, p.x, p.y);

    if (d <= currentRadius + p.size / 2) {
      if (p.type === 'INVASIVE') {
        // Purificar Planta Invasora!
        score += 10;
        purifiedCount++;
        hitInvasiveThisShot = true;

        // Efeito visual de partículas verdes/ciano
        createExplosion(p.x, p.y, color(52, 211, 153));
        playSound('hit_invasive');

        // Adicionar timestamp para o sistema de combos
        recentInvasiveTimestamps.push(now);

      } else if (p.type === 'NATIVE') {
        // Dano acidental em Planta Nativa!
        lives--;
        nativeHitsCount++;
        recentInvasiveTimestamps = []; // Reiniciar combo ao atingir nativa

        // Efeito visual vermelho de aviso
        createExplosion(p.x, p.y, color(239, 68, 68));
        playSound('hit_native');
      }

      plants.splice(i, 1);
    }
  }

  // Verificar ativação do Combo de Purificação (3 invasoras em < 5 seg)
  if (recentInvasiveTimestamps.length >= 3) {
    hasComboBonus = true;
    recentInvasiveTimestamps = []; // Consumido para ativar o bónus
    maxComboAchieved++;
    playSound('combo');
  }
}

// --- DISPARO MANUAL (TECLADO / RATO COMO ALTERNATIVA) ---
function keyPressed() {
  if (key === ' ' && gameState === STATE_PLAY) {
    triggerLaserShot(mouseX, mouseY);
  }
}

function mousePressed() {
  initAudioSynth();
  if (gameState === STATE_START) {
    let btnX = width / 2 - 130;
    let btnY = 465;
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

// --- CRIAR PARTÍCULAS DE EXPLOSÃO ---
function createExplosion(x, y, col) {
  for (let i = 0; i < 16; i++) {
    particles.push(new Particle(x, y, col));
  }
}

// --- DESENHAR RAIO LASER ---
function drawLaserBeam(x, y, radius, isBoosted) {
  push();
  // Raio proveniente do topo do ecrã até ao alvo
  strokeWeight(isBoosted ? 12 : 5);
  stroke(isBoosted ? color(251, 191, 36, 220) : color(56, 189, 248, 220));
  line(x, 0, x, y);

  // Anel de impacto no chão
  fill(isBoosted ? color(251, 191, 36, 100) : color(56, 189, 248, 80));
  stroke(isBoosted ? color(251, 191, 36) : color(56, 189, 248));
  strokeWeight(2);
  ellipse(x, y, radius * 2, radius * 1.2);
  pop();
}

// --- DESENHAR MIRA CUSTOMIZADA ---
function drawCrosshair(x, y) {
  push();
  translate(x, y);

  let isBoost = hasComboBonus;
  stroke(isBoost ? color(251, 191, 36) : color(239, 68, 68));
  strokeWeight(2);
  noFill();

  // Anel exterior
  circle(0, 0, isBoost ? 46 : 30);

  // Retículo central
  line(-20, 0, -8, 0);
  line(8, 0, 20, 0);
  line(0, -20, 0, -8);
  line(0, 8, 0, 20);

  // Ponto central
  fill(isBoost ? color(251, 191, 36) : color(239, 68, 68));
  circle(0, 0, 4);

  // Indicador de Combo Pronto
  if (isBoost) {
    textAlign(CENTER, BOTTOM);
    textSize(11);
    textStyle(BOLD);
    fill(251, 191, 36);
    text("SUPER LASER PRONTO!", 0, -26);
  }
  pop();
}

// --- INTERFACE HUD DE JOGO ---
function drawPlayHUD() {
  push();
  // Barra Superior
  fill(15, 23, 42, 220);
  noStroke();
  rect(0, 0, width, 55);

  // Pontuação e Vidas
  textAlign(LEFT, CENTER);
  textSize(18);
  textStyle(BOLD);
  fill(52, 211, 153);
  text(`Pontuação: ${score}`, 20, 28);

  fill(239, 68, 68);
  let heartStr = "♥ ".repeat(max(0, lives));
  text(`Vidas: ${heartStr}`, 200, 28);

  // Indicador de Combos
  fill(251, 191, 36);
  textSize(14);
  if (hasComboBonus) {
    text("COMBO ACTIVADO! (Raio Extra no próximo disparo)", 360, 28);
  } else {
    let recentHits = recentInvasiveTimestamps.length;
    fill(148, 163, 184);
    text(`Combo Sequência: ${recentHits}/3 (janela < 5s)`, 360, 28);
  }

  // Vu-Metro do Microfone com Limites de Histerese
  let meterX = width - 210;
  let meterY = 18;
  let meterW = 180;
  let meterH = 18;

  fill(30, 41, 59);
  stroke(71, 85, 105);
  strokeWeight(1);
  rect(meterX, meterY, meterW, meterH, 6);

  // Nível atual de áudio
  let fillW = constrain(micLevel * meterW * 2.5, 0, meterW);
  fill(canFireAudio ? color(16, 185, 129) : color(245, 158, 11));
  noStroke();
  rect(meterX, meterY, fillW, meterH, 6);

  // Linhas dos Limites de Histerese
  let highLineX = meterX + constrain(highThreshold * meterW * 2.5, 0, meterW);
  let lowLineX = meterX + constrain(lowThreshold * meterW * 2.5, 0, meterW);

  stroke(239, 68, 68); // Limite Superior (Disparo)
  strokeWeight(2);
  line(highLineX, meterY - 2, highLineX, meterY + meterH + 2);

  stroke(251, 191, 36); // Limite Inferior (Reset Histerese)
  line(lowLineX, meterY - 2, lowLineX, meterY + meterH + 2);

  textAlign(CENTER, TOP);
  textSize(10);
  fill(148, 163, 184);
  noStroke();
  text("Sensibilidade Mic & Histerese", meterX + meterW / 2, meterY + meterH + 4);
  pop();
}

// --- ECRÃ 3: RESULTADO / REPETIR (GAME OVER) ---
function drawGameOverScreen() {
  drawEnvironmentBackground();

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
  text("Relatório de Purificação do Solo", width / 2, 140);

  // Estatísticas Finais
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

  // Botão Jogar Novamente
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

// --- DESENHO DE AMBIENTE / CHÃO ---
function drawEnvironmentBackground() {
  // Céu gradiente escuro
  noStroke();
  fill(15, 23, 42);
  rect(0, 0, width, height - 90);

  // Solo / Terreno
  fill(30, 41, 59);
  rect(0, height - 90, width, 90);

  // Relva e linha de solo
  stroke(34, 197, 94);
  strokeWeight(4);
  line(0, height - 90, width, height - 90);

  // Textura do solo
  noStroke();
  fill(51, 65, 85);
  for (let x = 20; x < width; x += 40) {
    ellipse(x, height - 40, 15, 6);
  }
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
  spawnInterval = 90;
}
