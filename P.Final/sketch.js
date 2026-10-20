/* =========================================================================
   PURIFICADOR DE SOLOS - CONTROLO DE ESPÉCIES INVASORAS
   Unidade Curricular: Sistemas Multimédia (ECGM)
   Autor: Luís Martinho Oliveira Lopes (Nº 25361)
   Tema: Sustentabilidade e Ambiente (Controlo de Espécies Invasoras)
   ========================================================================= */

// --- 1. MÁQUINA DE ESTADOS (3 ECRÃS PRINCIPAIS) ---
const ESTADO_INICIO = 0;
const ESTADO_CALIBRACAO = 1;
const ESTADO_JOGO = 2;
const ESTADO_FIM = 3;

let estadoAtual = ESTADO_INICIO;

// --- 2. ASSETS MULTIMÉDIA (IMAGENS E SONS) ---
let imgInvasora;
let imgNativa;
let imgMira;
let imgCoracao;

let somFundo;
let somAcerto;
let somDano;
let musicaIniciada = false;

// --- 3. CONTROLO POR MICROFONE E HISTERESE ---
let mic;
let micIniciado = false;
let micLevel = 0;
let ruidoAmbiente = 0.02;
let highThreshold = 0.12; // Limite superior para acionar disparo
let lowThreshold = 0.05;  // Limite inferior para desarmar gatilho
let podeDispararAudio = true; // Controlo de histerese

// Variáveis de Calibração (Amostragem durante 3 segundos a 60 FPS)
let framesCalibracao = 0;
const TOTAL_FRAMES_CALIBRACAO = 180;
let somaRuidoCalibracao = 0;

// --- 4. VARIÁVEIS DO JOGO E FEEDBACK ---
let pontuacao = 0;
let vidas = 3;
let invasorasEliminadas = 0;
let nativasAtingidas = 0;
let combosAtivados = 0;

let plantas = [];
let particulas = [];
let textosFlutuantes = []; // Feedback visual dinâmico (+10, -1 Vida)
let efeitoLaser = null;

let temporizadorSpawn = 0;
let intervaloSpawn = 80;

// Temporizador de Sessão / Tempo de Jogo
let tempoInicioJogo = 0;
let tempoDecorridoJogo = 0;

// --- 5. FUNCIONALIDADE ORIGINAL: COMBOS DE PURIFICAÇÃO ---
// Eliminar 3 invasoras consecutivas em < 5 segundos = Super Laser no próximo tiro
let timestampsInvasoras = [];
let temSuperLaser = false;
const JANELA_TEMPO_COMBO = 5000; // 5000 ms = 5 segundos
const RAIO_LASER_NORMAL = 45;
const RAIO_LASER_SUPER = 100;

// --- PRELOAD: CARREGAMENTO DOS ASSETS ---
function preload() {
  // Carregar Imagens dos Assets
  imgInvasora = loadImage('assets/invasive.jpg');
  imgNativa = loadImage('assets/native.jpg');
  imgMira = loadImage('assets/target.jpg');
  imgCoracao = loadImage('assets/heart.jpg');

  // Carregar Ficheiros de Áudio
  soundFormats('mp3', 'wav');
  somFundo = loadSound('audio/fundo.mp3');
  somAcerto = loadSound('audio/acerto_invasora.wav');
  somDano = loadSound('audio/dano_nativa.wav');
}

// --- SETUP: INICIALIZAÇÃO DO CANVAS E DO ÁUDIO ---
function setup() {
  let canvas = createCanvas(900, 600);
  canvas.parent('game-container');
  textFont('Segoe UI');
  noCursor(); // A mira substitui o cursor em todos os ecrãs

  // Inicializar entrada de microfone
  mic = new p5.AudioIn();
}

// --- DRAW: CICLO PRINCIPAL DO PROGRAMA ---
function draw() {
  background(20, 27, 38);

  // Leitura contínua do microfone
  if (mic && micIniciado) {
    micLevel = mic.getLevel();
  }

  // Máquina de Estados
  switch (estadoAtual) {
    case ESTADO_INICIO:
      desenhaEcraInicio();
      break;
    case ESTADO_CALIBRACAO:
      desenhaEcraCalibracao();
      break;
    case ESTADO_JOGO:
      atualizaEDesenhaJogo();
      break;
    case ESTADO_FIM:
      desenhaEcraFim();
      break;
  }

  // A mira personalizada é desenhada em todos os ecrãs
  desenhaMira(mouseX, mouseY);
}

// =========================================================================
// ECRÃ 1: INÍCIO E INSTRUÇÕES
// =========================================================================
function desenhaEcraInicio() {
  desenhaFundoTerreno();

  push();
  fill(30, 41, 59, 235);
  stroke(51, 65, 85);
  strokeWeight(2);
  rect(90, 30, width - 180, height - 70, 16);

  textAlign(CENTER, TOP);
  fill(52, 211, 153);
  textSize(28);
  textStyle(BOLD);
  text("PURIFICADOR DE SOLOS", width / 2, 50);

  fill(226, 232, 240);
  textSize(15);
  textStyle(NORMAL);
  text("Controlo de Espécies Invasoras em Vista Aérea", width / 2, 86);

  textAlign(LEFT, TOP);
  let y = 125;
  textSize(13.5);
  fill(203, 213, 225);

  text("OBJETIVO DO EXERCÍCIO:", 120, y);
  fill(241, 245, 249);
  text("• Elimine as plantas invasoras (Chorão-das-praias) que surgem no solo.", 130, y + 20);
  text("• PRESERVE a flora nativa! Atingir espécies nativas retira vidas.", 130, y + 38);

  fill(203, 213, 225);
  text("CONTROLOS MULTIMÉDIA (RATO + MICROFONE):", 120, y + 70);
  fill(241, 245, 249);
  text("• Mira do Laser: Movimento do Rato.", 130, y + 90);
  text("• Disparo: Som no Microfone (Palmas, Estalos de Dedos, Assobio).", 130, y + 108);

  fill(251, 191, 36);
  text("FUNCIONALIDADE ORIGINAL - COMBOS DE PURIFICAÇÃO:", 120, y + 140);
  fill(241, 245, 249);
  text("• Elimine 3 invasoras consecutivas em menos de 5 segundos para ativar", 130, y + 160);
  text("  o SUPER LASER com o dobro do raio de destruição no próximo disparo!", 130, y + 178);

  // Barra de teste de microfone no ecrã inicial
  desenhaBarraMicrofone(width / 2, 360);

  // Botão "INICIAR CALIBRAÇÃO"
  let btnX = width / 2 - 130;
  let btnY = 460;
  let btnW = 260;
  let btnH = 50;

  let hover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
  fill(hover ? color(16, 185, 129) : color(5, 150, 105));
  stroke(hover ? color(255) : color(52, 211, 153));
  strokeWeight(hover ? 3 : 2);
  rect(btnX, btnY, btnW, btnH, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  textStyle(BOLD);
  text("INICIAR CALIBRAÇÃO", width / 2, btnY + btnH / 2);
  pop();

  desenhaRodape();
}

// Barra visual para testar o microfone em tempo real
function desenhaBarraMicrofone(cx, cy) {
  push();
  let w = 320, h = 16;
  let x = cx - w / 2;

  fill(15, 23, 42);
  stroke(71, 85, 105);
  strokeWeight(1);
  rect(x, cy, w, h, 6);

  let preenchimento = constrain(micLevel * w * 3.5, 0, w);
  fill(micIniciado ? (micLevel > highThreshold ? color(239, 68, 68) : color(16, 185, 129)) : color(100));
  noStroke();
  rect(x, cy, preenchimento, h, 6);

  textAlign(CENTER, BOTTOM);
  textSize(11);
  fill(148, 163, 184);
  text(micIniciado ? `Microfone Ativo: ${(micLevel * 100).toFixed(1)}%` : "Clique no botão abaixo para ligar o microfone", cx, cy - 4);
  pop();
}

// =========================================================================
// ECRÃ DE CALIBRAÇÃO DE ÁUDIO
// =========================================================================
function desenhaEcraCalibracao() {
  desenhaFundoTerreno();

  push();
  fill(30, 41, 59, 240);
  stroke(52, 211, 153);
  strokeWeight(2);
  rect(150, 120, width - 300, 340, 16);

  textAlign(CENTER, TOP);
  fill(52, 211, 153);
  textSize(26);
  textStyle(BOLD);
  text("CALIBRAÇÃO DE ÁUDIO", width / 2, 150);

  fill(226, 232, 240);
  textSize(16);
  textStyle(NORMAL);
  text("Mantenha silêncio para medir o ruído ambiente da sala...", width / 2, 195);

  framesCalibracao++;
  somaRuidoCalibracao += micLevel;

  let progresso = framesCalibracao / TOTAL_FRAMES_CALIBRACAO;
  fill(51, 65, 85);
  rect(200, 240, width - 400, 24, 12);
  fill(16, 185, 129);
  rect(200, 240, (width - 400) * progresso, 24, 12);

  fill(203, 213, 225);
  textSize(14);
  text(`Ruído Amostrado: ${(micLevel * 100).toFixed(1)}%`, width / 2, 280);

  // Terminou o período de amostragem
  if (framesCalibracao >= TOTAL_FRAMES_CALIBRACAO) {
    ruidoAmbiente = somaRuidoCalibracao / TOTAL_FRAMES_CALIBRACAO;
    // Configurar limites de histerese baseados no ruído da sala
    highThreshold = max(ruidoAmbiente * 2.6 + 0.07, 0.09);
    lowThreshold = highThreshold * 0.45;

    // Iniciar música de fundo e transitar para o jogo
    if (somFundo && !musicaIniciada) {
      somFundo.loop();
      musicaIniciada = true;
    }

    estadoAtual = ESTADO_JOGO;
    reiniciarDadosJogo();
  }
  pop();

  desenhaRodape();
}

// =========================================================================
// ECRÃ 2: EXECUÇÃO (JOGO EM VISTA AÉREA)
// =========================================================================
function atualizaEDesenhaJogo() {
  desenhaFundoTerreno();

  // Atualizar temporizador de jogo decorrido
  tempoDecorridoJogo = floor((millis() - tempoInicioJogo) / 1000);

  // Germinação aleatória de plantas
  temporizadorSpawn++;
  if (temporizadorSpawn >= intervaloSpawn) {
    temporizadorSpawn = 0;
    let px = random(60, width - 60);
    let py = random(85, height - 60);
    let tipo = random() < 0.65 ? 'INVASORA' : 'NATIVA';
    plantas.push(new Planta(px, py, tipo));

    if (intervaloSpawn > 40) intervaloSpawn -= 0.5;
  }

  // Atualizar e desenhar plantas
  for (let i = plantas.length - 1; i >= 0; i--) {
    let p = plantas[i];
    p.atualiza();
    p.desenha();
    if (!p.viva) plantas.splice(i, 1);
  }

  // Atualizar e desenhar partículas
  for (let i = particulas.length - 1; i >= 0; i--) {
    let pt = particulas[i];
    pt.atualiza();
    pt.desenha();
    if (pt.alpha <= 0) particulas.splice(i, 1);
  }

  // Atualizar e desenhar feedback de textos flutuantes
  for (let i = textosFlutuantes.length - 1; i >= 0; i--) {
    let tf = textosFlutuantes[i];
    tf.atualiza();
    tf.desenha();
    if (tf.alpha <= 0) textosFlutuantes.splice(i, 1);
  }

  // Verificação contínua do disparo por áudio com Histerese
  verificaDisparoHisterese();

  // Efeito visual do laser
  if (efeitoLaser) {
    desenhaEfeitoLaser(efeitoLaser.x, efeitoLaser.y, efeitoLaser.raio, efeitoLaser.isSuper);
    efeitoLaser.vida--;
    if (efeitoLaser.vida <= 0) efeitoLaser = null;
  }

  // Condição de fim de jogo
  if (vidas <= 0) {
    estadoAtual = ESTADO_FIM;
  }

  desenhaHUDJogo();
  desenhaRodape();
}

// Lógica de Histerese de Áudio
function verificaDisparoHisterese() {
  if (micLevel >= highThreshold && podeDispararAudio) {
    dispararLaser(mouseX, mouseY);
    podeDispararAudio = false; // Tranca até o som baixar
  }
  if (micLevel < lowThreshold) {
    podeDispararAudio = true; // Rearma o gatilho
  }
}

// Disparo do Laser Purificador
function dispararLaser(alvoX, alvoY) {
  let agora = millis();
  timestampsInvasoras = timestampsInvasoras.filter(t => agora - t <= JANELA_TEMPO_COMBO);

  let raioAtual = temSuperLaser ? RAIO_LASER_SUPER : RAIO_LASER_NORMAL;
  let disparoSuper = temSuperLaser;

  efeitoLaser = { x: alvoX, y: alvoY, raio: raioAtual, vida: 14, isSuper: disparoSuper };

  if (temSuperLaser) {
    temSuperLaser = false;
  }

  // Deteção de Colisões Circulares
  for (let i = plantas.length - 1; i >= 0; i--) {
    let p = plantas[i];
    let d = dist(alvoX, alvoY, p.x, p.y);

    if (d <= raioAtual + p.diam / 2) {
      if (p.tipo === 'INVASORA') {
        // Acerto em invasora (Som Bom)
        pontuacao += 10;
        invasorasEliminadas++;
        criaExplosao(p.x, p.y, color(52, 211, 153));
        textosFlutuantes.push(new TextoFlutuante(p.x, p.y - 15, "+10", color(52, 211, 153)));
        if (somAcerto) somAcerto.play();
        timestampsInvasoras.push(agora);
      } else if (p.tipo === 'NATIVA') {
        // Dano em nativa (Som Mau)
        vidas--;
        nativasAtingidas++;
        timestampsInvasoras = [];
        criaExplosao(p.x, p.y, color(239, 68, 68));
        textosFlutuantes.push(new TextoFlutuante(p.x, p.y - 15, "-1 VIDA", color(239, 68, 68)));
        if (somDano) somDano.play();
      }
      plantas.splice(i, 1);
    }
  }

  // Ativação do Combo (3 invasoras em < 5 seg)
  if (timestampsInvasoras.length >= 3) {
    temSuperLaser = true;
    timestampsInvasoras = [];
    combosAtivados++;
    textosFlutuantes.push(new TextoFlutuante(width / 2, height / 2 - 40, "SUPER LASER ATIVADO!", color(251, 191, 36)));
  }
}

// Interface de Jogo (HUD no Topo com Feedback Completo)
function desenhaHUDJogo() {
  push();
  fill(15, 23, 42, 225);
  noStroke();
  rect(0, 0, width, 55);

  // Pontuação
  textAlign(LEFT, CENTER);
  textSize(18);
  textStyle(BOLD);
  fill(52, 211, 153);
  text(`Pontos: ${pontuacao}`, 20, 28);

  // Vidas (com ícone gráfico heart.jpg)
  let heartX = 160;
  for (let i = 0; i < vidas; i++) {
    if (imgCoracao) {
      image(imgCoracao, heartX + i * 26, 16, 22, 22);
    } else {
      fill(239, 68, 68);
      text("♥", heartX + i * 22, 28);
    }
  }

  // Temporizador de Jogo Ativo (Feedback Constante Requisito 9)
  let min = floor(tempoDecorridoJogo / 60);
  let seg = tempoDecorridoJogo % 60;
  let tempoStr = nf(min, 2) + ":" + nf(seg, 2);
  fill(226, 232, 240);
  textSize(15);
  text(`Tempo: ${tempoStr}`, 275, 28);

  // Estado dos Combos
  textSize(14);
  if (temSuperLaser) {
    fill(251, 191, 36);
    text("SUPER LASER ATIVO!", 420, 28);
  } else {
    fill(148, 163, 184);
    text(`Combo: ${timestampsInvasoras.length}/3 (< 5s)`, 420, 28);
  }

  // VU-Metro com limites de Histerese
  let mx = width - 210, my = 18, mw = 180, mh = 18;
  fill(30, 41, 59);
  stroke(71, 85, 105);
  strokeWeight(1);
  rect(mx, my, mw, mh, 6);

  let fillW = constrain(micLevel * mw * 3.5, 0, mw);
  fill(podeDispararAudio ? color(16, 185, 129) : color(245, 158, 11));
  noStroke();
  rect(mx, my, fillW, mh, 6);

  // Linhas de histerese
  stroke(239, 68, 68);
  strokeWeight(2);
  let hx = mx + constrain(highThreshold * mw * 3.5, 0, mw);
  let lx = mx + constrain(lowThreshold * mw * 3.5, 0, mw);
  line(hx, my - 2, hx, my + mh + 2);
  stroke(251, 191, 36);
  line(lx, my - 2, lx, my + mh + 2);
  pop();
}

// =========================================================================
// ECRÃ 3: RESULTADO / REPETIR (GAME OVER)
// =========================================================================
function desenhaEcraFim() {
  desenhaFundoTerreno();

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

  textAlign(LEFT, TOP);
  let sy = 185;
  textSize(16);
  fill(203, 213, 225);

  text(`• Pontuação Final:`, 200, sy);
  fill(52, 211, 153);
  textStyle(BOLD);
  text(`${pontuacao} pontos`, 420, sy);

  fill(203, 213, 225);
  textStyle(NORMAL);
  text(`• Tempo de Sobrevivência:`, 200, sy + 32);
  fill(226, 232, 240);
  let min = floor(tempoDecorridoJogo / 60);
  let seg = tempoDecorridoJogo % 60;
  text(`${nf(min, 2)}m ${nf(seg, 2)}s`, 450, sy + 32);

  fill(203, 213, 225);
  text(`• Invasoras Purificadas:`, 200, sy + 64);
  fill(241, 245, 249);
  text(`${invasorasEliminadas}`, 450, sy + 64);

  fill(203, 213, 225);
  text(`• Danos em Plantas Nativas:`, 200, sy + 96);
  fill(239, 68, 68);
  text(`${nativasAtingidas}`, 450, sy + 96);

  fill(203, 213, 225);
  text(`• Combos Ativados:`, 200, sy + 128);
  fill(251, 191, 36);
  text(`${combosAtivados}`, 450, sy + 128);

  // Botão "REPETIR EXERCÍCIO"
  let btnX = width / 2 - 120;
  let btnY = 445;
  let btnW = 240;
  let btnH = 50;

  let hover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
  fill(hover ? color(59, 130, 246) : color(37, 99, 235));
  stroke(hover ? color(255) : color(96, 165, 250));
  strokeWeight(hover ? 3 : 2);
  rect(btnX, btnY, btnW, btnH, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  textStyle(BOLD);
  text("REPETIR EXERCÍCIO", width / 2, btnY + btnH / 2);
  pop();

  desenhaRodape();
}

// =========================================================================
// EVENTOS DE ENTRADA DO RATO
// =========================================================================
function mousePressed() {
  // Inicialização explícita de áudio requerida pelos navegadores
  userStartAudio().then(() => {
    if (mic && !micIniciado) {
      mic.start(() => { micIniciado = true; });
    }
  });

  if (estadoAtual === ESTADO_INICIO) {
    let btnX = width / 2 - 130, btnY = 460, btnW = 260, btnH = 50;
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      estadoAtual = ESTADO_CALIBRACAO;
      framesCalibracao = 0;
      somaRuidoCalibracao = 0;
    }
  } else if (estadoAtual === ESTADO_JOGO) {
    // Permite disparo alternativo de teste por clique
    dispararLaser(mouseX, mouseY);
  } else if (estadoAtual === ESTADO_FIM) {
    let btnX = width / 2 - 120, btnY = 445, btnW = 240, btnH = 50;
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      estadoAtual = ESTADO_JOGO;
      reiniciarDadosJogo();
    }
  }
}

// =========================================================================
// CLASSES DE OBJETOS: PLANTA, PARTÍCULA E TEXTO FLUTUANTE
// =========================================================================
class Planta {
  constructor(x, y, tipo) {
    this.x = x;
    this.y = y;
    this.tipo = tipo; // 'INVASORA' ou 'NATIVA'
    this.diam = tipo === 'INVASORA' ? random(45, 60) : random(38, 50);
    this.viva = true;
    this.idade = 0;
    this.tempoMaximo = tipo === 'INVASORA' ? 450 : 600;
  }

  atualiza() {
    this.idade++;
    if (this.idade > this.tempoMaximo) {
      this.viva = false;
    }
  }

  desenha() {
    push();
    imageMode(CENTER);
    // Animação orgânica de pulso suave
    let pulso = 1.0 + sin(frameCount * 0.05 + this.x) * 0.04;
    let d = this.diam * pulso;

    if (this.tipo === 'INVASORA') {
      if (imgInvasora) {
        image(imgInvasora, this.x, this.y, d, d);
      }
      noFill();
      stroke(239, 68, 68, 120);
      strokeWeight(1.5);
      circle(this.x, this.y, d + 4);
    } else {
      if (imgNativa) {
        image(imgNativa, this.x, this.y, d, d);
      }
      noFill();
      stroke(52, 211, 153, 100);
      strokeWeight(1);
      circle(this.x, this.y, d + 4);
    }
    pop();
  }
}

class Particula {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.vx = random(-4, 4);
    this.vy = random(-4, 4);
    this.alpha = 255;
    this.col = col;
    this.tamanho = random(4, 8);
  }

  atualiza() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.alpha -= 8;
  }

  desenha() {
    push();
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), this.alpha);
    circle(this.x, this.y, this.tamanho);
    pop();
  }
}

// Classe de Feedback Visual Flutuante (+10, -1 Vida, Combo)
class TextoFlutuante {
  constructor(x, y, texto, cor) {
    this.x = x;
    this.y = y;
    this.texto = texto;
    this.cor = cor;
    this.alpha = 255;
    this.vy = -1.4;
  }

  atualiza() {
    this.y += this.vy;
    this.alpha -= 5;
  }

  desenha() {
    push();
    textAlign(CENTER, CENTER);
    textSize(16);
    textStyle(BOLD);
    fill(red(this.cor), green(this.cor), blue(this.cor), this.alpha);
    text(this.texto, this.x, this.y);
    pop();
  }
}

function criaExplosao(x, y, col) {
  for (let i = 0; i < 16; i++) {
    particulas.push(new Particula(x, y, col));
  }
}

// Efeito do feixe laser orbital
function desenhaEfeitoLaser(x, y, raio, isSuper) {
  push();
  strokeWeight(isSuper ? 14 : 7);
  stroke(isSuper ? color(251, 191, 36, 230) : color(56, 189, 248, 230));
  line(x, y - 300, x, y);

  fill(isSuper ? color(251, 191, 36, 110) : color(56, 189, 248, 80));
  stroke(isSuper ? color(251, 191, 36) : color(56, 189, 248));
  strokeWeight(2.5);
  circle(x, y, raio * 2);
  pop();
}

// Mira personalizada com suporte ao asset target.jpg
function desenhaMira(x, y) {
  push();
  imageMode(CENTER);
  let tamMira = temSuperLaser ? 48 : 34;

  if (imgMira) {
    image(imgMira, x, y, tamMira, tamMira);
  } else {
    stroke(temSuperLaser ? color(251, 191, 36) : color(239, 68, 68));
    strokeWeight(2);
    noFill();
    circle(x, y, tamMira);
    line(x - 15, y, x + 15, y);
    line(x, y - 15, x, y + 15);
  }
  pop();
}

// Terreno quadriculado em vista aérea
function desenhaFundoTerreno() {
  background(20, 35, 28);
  stroke(28, 48, 38);
  strokeWeight(1);
  for (let x = 0; x < width; x += 50) line(x, 0, x, height);
  for (let y = 0; y < height; y += 50) line(0, y, width, y);
}

// --- RODAPÉ OBRIGATÓRIO EM TODOS OS ECRÃS ---
function desenhaRodape() {
  push();
  textSize(13);
  textStyle(BOLD);

  // Canto Inferior Esquerdo: Tema em inglês
  textAlign(LEFT, BOTTOM);
  fill(148, 163, 184);
  text("Invasive Species Control", 15, height - 12);

  // Canto Inferior Direito: Nome, número e sigla
  textAlign(RIGHT, BOTTOM);
  fill(52, 211, 153);
  text("Luís Lopes, nº 25361, ECGM", width - 15, height - 12);
  pop();
}

function reiniciarDadosJogo() {
  pontuacao = 0;
  vidas = 3;
  invasorasEliminadas = 0;
  nativasAtingidas = 0;
  combosAtivados = 0;
  plantas = [];
  particulas = [];
  textosFlutuantes = [];
  timestampsInvasoras = [];
  temSuperLaser = false;
  temporizadorSpawn = 0;
  intervaloSpawn = 80;
  tempoInicioJogo = millis();
  tempoDecorridoJogo = 0;
}
