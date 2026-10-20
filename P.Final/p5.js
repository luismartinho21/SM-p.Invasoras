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
let imgCampo; // Fundo real de campo verde
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
let micLevelAnterior = 0; // Para deteção de transiente / estalo de dedos
let ruidoAmbiente = 0.02;
let highThreshold = 0.09; // Limite superior para acionar disparo
let lowThreshold = 0.04;  // Limite inferior para desarmar gatilho
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
let zonasPurificadas = []; // Regeneração ecológica do solo purificado
let ondasImpacto = [];     // Anéis de onda de impacto dos disparos
let efeitoLaser = null;

let temporizadorSpawn = 0;
let intervaloSpawn = 80;
let nivelJogo = 1;         // Dificuldade progressiva (Fases 1 a 4)

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
  // Carregar Imagens dos Assets (Interface e Entidades)
  imgCampo = loadImage('assets/campo.jpg');
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

  // Leitura contínua do microfone (sem smoothing para captar o estalo de dedos de forma instantânea)
  if (mic && micIniciado) {
    micLevelAnterior = micLevel;
    micLevel = mic.getLevel(0.0);
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
  text("• Disparo por Áudio: Estalo de Dedos (ou palma rápida junto ao microfone).", 130, y + 108);

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
  text("Mantenha silêncio... O jogo calibra-se para detetar os seus estalos de dedos!", width / 2, 195);

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
    // Limites de histerese afinados para captar estalos de dedos com precisão
    highThreshold = max(ruidoAmbiente * 2.2 + 0.045, 0.075);
    lowThreshold = max(ruidoAmbiente * 1.25 + 0.015, 0.03);

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

  // Gestão da dificuldade progressiva por fases
  atualizaDificuldadeProgressiva();

  // Atualizar e desenhar zonas de solo purificado (camada inferior do terreno)
  for (let i = zonasPurificadas.length - 1; i >= 0; i--) {
    let zp = zonasPurificadas[i];
    zp.atualiza();
    zp.desenha();
    if (zp.vida <= 0) zonasPurificadas.splice(i, 1);
  }

  // Germinação com ritmo ajustado à fase de dificuldade
  temporizadorSpawn++;
  if (temporizadorSpawn >= intervaloSpawn) {
    temporizadorSpawn = 0;
    let px = random(60, width - 60);
    let py = random(85, height - 60);
    let probInvasora = nivelJogo >= 3 ? 0.72 : 0.65;
    let tipo = random() < probInvasora ? 'INVASORA' : 'NATIVA';
    plantas.push(new Planta(px, py, tipo));
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

  // Atualizar e desenhar ondas de impacto dos disparos
  for (let i = ondasImpacto.length - 1; i >= 0; i--) {
    let onda = ondasImpacto[i];
    onda.atualiza();
    onda.desenha();
    if (onda.alpha <= 0) ondasImpacto.splice(i, 1);
  }

  // Atualizar e desenhar feedback de textos flutuantes
  for (let i = textosFlutuantes.length - 1; i >= 0; i--) {
    let tf = textosFlutuantes[i];
    tf.atualiza();
    tf.desenha();
    if (tf.alpha <= 0) textosFlutuantes.splice(i, 1);
  }

  // Verificação contínua do disparo por áudio com Histerese e Estalo de Dedos
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

// Dificuldade progressiva ao longo do tempo de sobrevivência e pontuação
function atualizaDificuldadeProgressiva() {
  let novoNivel = 1;
  if (tempoDecorridoJogo >= 90 || pontuacao >= 400) {
    novoNivel = 4;
  } else if (tempoDecorridoJogo >= 50 || pontuacao >= 220) {
    novoNivel = 3;
  } else if (tempoDecorridoJogo >= 25 || pontuacao >= 100) {
    novoNivel = 2;
  }

  if (novoNivel > nivelJogo) {
    nivelJogo = novoNivel;
    const nomesFase = ["", "Recuperação", "Dispersão Ativa", "Infestação Severa", "Alerta Máximo"];
    textosFlutuantes.push(new TextoFlutuante(width / 2, height / 2 - 25, `FASE ${nivelJogo}: ${nomesFase[nivelJogo].toUpperCase()}!`, color(56, 189, 248)));
  }

  switch (nivelJogo) {
    case 1: intervaloSpawn = 80; break;
    case 2: intervaloSpawn = 62; break;
    case 3: intervaloSpawn = 48; break;
    case 4: intervaloSpawn = 36; break;
  }
}

// Lógica de Histerese de Áudio com Deteção de Estalo de Dedos (Transiente Rápido)
function verificaDisparoHisterese() {
  let deltaNivel = micLevel - micLevelAnterior;
  // Um estalo de dedos caracteriza-se por um pico quase vertical num único frame (delta acentuado)
  let ehEstalo = deltaNivel >= 0.038 && micLevel >= (ruidoAmbiente + 0.03);
  let cruzouLimite = micLevel >= highThreshold;

  if ((cruzouLimite || ehEstalo) && podeDispararAudio) {
    dispararLaser(mouseX, mouseY);
    podeDispararAudio = false; // Tranca temporariamente para evitar múltiplos disparos com um só estalo
  }

  // Rearme da histerese quando o ruído volta a níveis calmos
  if (micLevel < lowThreshold) {
    podeDispararAudio = true;
  }
}

// Disparo do Laser Purificador
function dispararLaser(alvoX, alvoY) {
  let agora = millis();
  timestampsInvasoras = timestampsInvasoras.filter(t => agora - t <= JANELA_TEMPO_COMBO);

  let raioAtual = temSuperLaser ? RAIO_LASER_SUPER : RAIO_LASER_NORMAL;
  let disparoSuper = temSuperLaser;

  efeitoLaser = { x: alvoX, y: alvoY, raio: raioAtual, vida: 14, isSuper: disparoSuper };
  ondasImpacto.push(new OndaImpacto(alvoX, alvoY, raioAtual, disparoSuper));

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
        zonasPurificadas.push(new ZonaPurificada(p.x, p.y, p.diam));
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

// Interface de Jogo (HUD no Topo com Feedback Completo sobre o campo verde)
function desenhaHUDJogo() {
  push();
  // Barra sutil e translúcida para manter a imagem do campo verde visível por baixo
  fill(10, 25, 18, 140);
  noStroke();
  rect(0, 0, width, 52);
  stroke(34, 197, 94, 50);
  strokeWeight(1);
  line(0, 52, width, 52);

  // Pontuação
  textAlign(LEFT, CENTER);
  textSize(16);
  textStyle(BOLD);
  fill(52, 211, 153);
  text(`Pontos: ${pontuacao}`, 16, 26);

  // Vidas (com ícone gráfico heart.jpg)
  let heartX = 140;
  for (let i = 0; i < vidas; i++) {
    if (imgCoracao) {
      image(imgCoracao, heartX + i * 25, 15, 22, 22);
    } else {
      fill(239, 68, 68);
      text("♥", heartX + i * 22, 26);
    }
  }

  // Temporizador de Jogo Ativo (Feedback Constante Requisito 9)
  let min = floor(tempoDecorridoJogo / 60);
  let seg = tempoDecorridoJogo % 60;
  let tempoStr = nf(min, 2) + ":" + nf(seg, 2);
  fill(241, 245, 249);
  textSize(14);
  textStyle(NORMAL);
  text(`Tempo: ${tempoStr}`, 235, 26);

  // Fase / Nível de Dificuldade
  let corNivel = nivelJogo === 1 ? color(52, 211, 153) : (nivelJogo === 2 ? color(56, 189, 248) : (nivelJogo === 3 ? color(251, 191, 36) : color(239, 68, 68)));
  fill(corNivel);
  textStyle(BOLD);
  text(`Fase ${nivelJogo}`, 350, 26);

  // Estado dos Combos
  textStyle(NORMAL);
  textSize(13);
  if (temSuperLaser) {
    fill(251, 191, 36);
    textStyle(BOLD);
    text("SUPER LASER ATIVO!", 425, 26);
  } else {
    fill(203, 213, 225);
    text(`Combo: ${timestampsInvasoras.length}/3 (<5s)`, 425, 26);
  }

  // VU-Metro com limites de Histerese (especializado para estalos de dedos)
  let mx = width - 210, my = 17, mw = 180, mh = 18;
  fill(15, 23, 42, 180);
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
  let sy = 175;
  let espaco = 26;
  textSize(15.5);
  fill(203, 213, 225);

  text(`• Pontuação Final:`, 190, sy);
  fill(52, 211, 153);
  textStyle(BOLD);
  text(`${pontuacao} pontos`, 440, sy);

  fill(203, 213, 225);
  textStyle(NORMAL);
  text(`• Tempo de Sobrevivência:`, 190, sy + espaco);
  fill(226, 232, 240);
  let min = floor(tempoDecorridoJogo / 60);
  let seg = tempoDecorridoJogo % 60;
  text(`${nf(min, 2)}m ${nf(seg, 2)}s`, 440, sy + espaco);

  fill(203, 213, 225);
  text(`• Fase Ecológica Atingida:`, 190, sy + espaco * 2);
  const nomesFase = ["", "Recuperação", "Dispersão Ativa", "Infestação Severa", "Alerta Máximo"];
  fill(56, 189, 248);
  text(`Fase ${nivelJogo} (${nomesFase[nivelJogo]})`, 440, sy + espaco * 2);

  fill(203, 213, 225);
  text(`• Invasoras Purificadas:`, 190, sy + espaco * 3);
  fill(241, 245, 249);
  text(`${invasorasEliminadas}`, 440, sy + espaco * 3);

  fill(203, 213, 225);
  text(`• Danos em Plantas Nativas:`, 190, sy + espaco * 4);
  fill(239, 68, 68);
  text(`${nativasAtingidas}`, 440, sy + espaco * 4);

  fill(203, 213, 225);
  text(`• Combos Ativados:`, 190, sy + espaco * 5);
  fill(251, 191, 36);
  text(`${combosAtivados}`, 440, sy + espaco * 5);

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

// Classe de Regeneração Ecológica do Solo
class ZonaPurificada {
  constructor(x, y, raio) {
    this.x = x;
    this.y = y;
    this.raio = raio;
    this.vida = 80;
    this.maxVida = 80;
  }

  atualiza() {
    this.vida--;
  }

  desenha() {
    push();
    let progresso = this.vida / this.maxVida;
    let alpha = progresso * 110;
    noStroke();
    fill(52, 211, 153, alpha);
    circle(this.x, this.y, this.raio * 1.15);

    // Pequenas partículas de pólen que sobem da terra regenerada
    stroke(167, 243, 208, alpha * 1.5);
    strokeWeight(2);
    let subida = (1 - progresso) * 16;
    point(this.x - 8, this.y - subida);
    point(this.x + 8, this.y - subida * 1.1);
    pop();
  }
}

// Classe de Onda de Impacto / Choque do Disparo
class OndaImpacto {
  constructor(x, y, raioMaximo, isSuper) {
    this.x = x;
    this.y = y;
    this.raioAtual = 6;
    this.raioMaximo = raioMaximo;
    this.isSuper = isSuper;
    this.alpha = 240;
  }

  atualiza() {
    this.raioAtual += (this.raioMaximo - this.raioAtual) * 0.25 + 1.2;
    this.alpha -= 15;
  }

  desenha() {
    push();
    noFill();
    if (this.isSuper) {
      stroke(251, 191, 36, this.alpha);
      strokeWeight(3.5);
    } else {
      stroke(56, 189, 248, this.alpha);
      strokeWeight(2.2);
    }
    circle(this.x, this.y, this.raioAtual * 2);
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

// Interface do terreno através de imagem real de campo verde (sem grelha codificada)
function desenhaFundoTerreno() {
  if (imgCampo) {
    image(imgCampo, 0, 0, width, height);
  } else {
    background(25, 55, 35);
  }
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
  zonasPurificadas = [];
  ondasImpacto = [];
  timestampsInvasoras = [];
  temSuperLaser = false;
  temporizadorSpawn = 0;
  intervaloSpawn = 80;
  nivelJogo = 1;
  tempoInicioJogo = millis();
  tempoDecorridoJogo = 0;
}
