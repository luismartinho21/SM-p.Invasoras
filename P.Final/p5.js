// Purificador de Solos - Controlo de Especies Invasoras
// Luis Lopes, nº 25361, ECGM

// estados possiveis do jogo
const ESTADO_INICIO = 0;
const ESTADO_CALIBRACAO = 1;
const ESTADO_JOGO = 2;
const ESTADO_FIM = 3;

let estadoAtual = ESTADO_INICIO;

// imagens e sons
let imgCampo;
let imgCardInicio;
let imgCardFim;
let imgCardCalibracao;
let imgBarraAudio;
let imgInvasora;
let imgNativa;
let imgMira;
let imgCoracao;

let somFundo;
let somAcerto;
let somDano;
let musicaIniciada = false;

// controlo por som do microfone e histerese
let mic;
let micIniciado = false;
let micLevel = 0;
let micLevelAnterior = 0;
let ruidoAmbiente = 0.02;
let highThreshold = 0.09;
let lowThreshold = 0.04;
let podeDispararAudio = true;

// variaveis para medir o silencio da sala (3 segundos a 60 fps)
let framesCalibracao = 0;
const TOTAL_FRAMES_CALIBRACAO = 180;
let somaRuidoCalibracao = 0;

// dados da partida
let pontuacao = 0;
let vidas = 3;
let invasorasEliminadas = 0;
let nativasAtingidas = 0;
let combosAtivados = 0;

let plantas = [];
let particulas = [];
let textosFlutuantes = [];
let zonasPurificadas = [];
let ondasImpacto = [];
let efeitoLaser = null;

let temporizadorSpawn = 0;
let intervaloSpawn = 80;
let nivelJogo = 1;

// temporizador da sessao
let tempoInicioJogo = 0;
let tempoDecorridoJogo = 0;

// combo: eliminar 3 invasoras em menos de 5s da direito a super laser
let timestampsInvasoras = [];
let temSuperLaser = false;
const JANELA_TEMPO_COMBO = 5000;
const RAIO_LASER_NORMAL = 45;
const RAIO_LASER_SUPER = 100;

// carregar assets antes de iniciar
function preload() {
  imgCampo = loadImage('assets/campo.jpg');
  imgCardInicio = loadImage('assets/card_inicio.png');
  imgCardFim = loadImage('assets/card_fim.png');
  imgCardCalibracao = loadImage('assets/card_calibracao.png');
  imgBarraAudio = loadImage('assets/barra_audio.png');
  imgInvasora = loadImage('assets/invasive.png');
  imgNativa = loadImage('assets/native.png');
  imgMira = loadImage('assets/target.png');
  imgCoracao = loadImage('assets/heart.png');

  soundFormats('mp3', 'wav');
  somFundo = loadSound('audio/fundo.mp3');
  somAcerto = loadSound('audio/acerto_invasora.wav');
  somDano = loadSound('audio/dano_nativa.wav');
}

// inicializacao do canvas e do microfone
function setup() {
  let canvas = createCanvas(900, 600);
  canvas.parent('game-container');
  textFont('Segoe UI');
  noCursor();

  mic = new p5.AudioIn();
}

// loop principal
function draw() {
  // ler o microfone sem suavizacao para apanhar logo o pico do estalo
  if (mic && micIniciado) {
    micLevelAnterior = micLevel;
    micLevel = mic.getLevel(0.0);
  }

  switch (estadoAtual) {
    case ESTADO_INICIO:
      desenhaEcraInicio(); // definido em instrucoes.js
      break;
    case ESTADO_CALIBRACAO:
      desenhaEcraCalibracao(); // definido em instrucoes.js
      break;
    case ESTADO_JOGO:
      atualizaEDesenhaJogo();
      break;
    case ESTADO_FIM:
      desenhaEcraFim(); // definido em final.js
      break;
  }

  // mira segue sempre o rato
  desenhaMira(mouseX, mouseY);
}

// loop do jogo principal
function atualizaEDesenhaJogo() {
  desenhaFundoTerreno();

  tempoDecorridoJogo = floor((millis() - tempoInicioJogo) / 1000);

  atualizaDificuldadeProgressiva();

  // desenhar as marcas de solo purificado
  for (let i = zonasPurificadas.length - 1; i >= 0; i--) {
    let zp = zonasPurificadas[i];
    zp.atualiza();
    zp.desenha();
    if (zp.vida <= 0) zonasPurificadas.splice(i, 1);
  }

  // nascimento de plantas garantindo que nenhuma nasce em cima ou atras de outra
  temporizadorSpawn++;
  if (temporizadorSpawn >= intervaloSpawn) {
    temporizadorSpawn = 0;
    let px, py;
    let posicaoLivre = false;
    let tentativas = 0;

    // procura coordenadas livres com distancia minima de seguranca
    while (!posicaoLivre && tentativas < 25) {
      px = random(60, width - 60);
      py = random(85, height - 65);
      posicaoLivre = true;
      for (let p of plantas) {
        if (dist(px, py, p.x, p.y) < 75) {
          posicaoLivre = false;
          break;
        }
      }
      tentativas++;
    }

    let probInvasora = nivelJogo >= 3 ? 0.72 : 0.65;
    let tipo = random() < probInvasora ? 'INVASORA' : 'NATIVA';
    plantas.push(new Planta(px, py, tipo));
  }

  // atualizar e desenhar as plantas
  for (let i = plantas.length - 1; i >= 0; i--) {
    let p = plantas[i];
    p.atualiza();
    p.desenha();
    if (!p.viva) plantas.splice(i, 1);
  }

  // particulas de explosao
  for (let i = particulas.length - 1; i >= 0; i--) {
    let pt = particulas[i];
    pt.atualiza();
    pt.desenha();
    if (pt.alpha <= 0) particulas.splice(i, 1);
  }

  // ondas de impacto do laser
  for (let i = ondasImpacto.length - 1; i >= 0; i--) {
    let onda = ondasImpacto[i];
    onda.atualiza();
    onda.desenha();
    if (onda.alpha <= 0) ondasImpacto.splice(i, 1);
  }

  // textos flutuantes de pontos e avisos
  for (let i = textosFlutuantes.length - 1; i >= 0; i--) {
    let tf = textosFlutuantes[i];
    tf.atualiza();
    tf.desenha();
    if (tf.alpha <= 0) textosFlutuantes.splice(i, 1);
  }

  // verificar se houve estalo de dedos para disparar
  verificaDisparoHisterese();

  // animacao do feixe laser
  if (efeitoLaser) {
    desenhaEfeitoLaser(efeitoLaser.x, efeitoLaser.y, efeitoLaser.raio, efeitoLaser.isSuper);
    efeitoLaser.vida--;
    if (efeitoLaser.vida <= 0) efeitoLaser = null;
  }

  if (vidas <= 0) {
    estadoAtual = ESTADO_FIM;
  }

  desenhaHUDJogo();
  desenhaRodape();
}

// subir o nivel conforme o tempo passa
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

// detecao de estalo de dedos com histerese
function verificaDisparoHisterese() {
  let deltaNivel = micLevel - micLevelAnterior;
  let ehEstalo = deltaNivel >= 0.038 && micLevel >= (ruidoAmbiente + 0.03);
  let cruzouLimite = micLevel >= highThreshold;

  if ((cruzouLimite || ehEstalo) && podeDispararAudio) {
    dispararLaser(mouseX, mouseY);
    podeDispararAudio = false;
  }

  if (micLevel < lowThreshold) {
    podeDispararAudio = true;
  }
}

// disparo do laser purificador
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

  for (let i = plantas.length - 1; i >= 0; i--) {
    let p = plantas[i];
    let d = dist(alvoX, alvoY, p.x, p.y);

    if (d <= raioAtual + p.diam / 2) {
      if (p.tipo === 'INVASORA') {
        pontuacao += 10;
        invasorasEliminadas++;
        criaExplosao(p.x, p.y, color(52, 211, 153));
        zonasPurificadas.push(new ZonaPurificada(p.x, p.y, p.diam));
        textosFlutuantes.push(new TextoFlutuante(p.x, p.y - 15, "+10", color(52, 211, 153)));
        if (somAcerto) somAcerto.play();
        timestampsInvasoras.push(agora);
      } else if (p.tipo === 'NATIVA') {
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

  if (timestampsInvasoras.length >= 3) {
    temSuperLaser = true;
    timestampsInvasoras = [];
    combosAtivados++;
    textosFlutuantes.push(new TextoFlutuante(width / 2, height / 2 - 40, "SUPER LASER ATIVADO!", color(251, 191, 36)));
  }
}

// hud no topo sobre o campo verde
function desenhaHUDJogo() {
  push();
  fill(10, 25, 18, 140);
  noStroke();
  rect(0, 0, width, 52);
  stroke(34, 197, 94, 50);
  strokeWeight(1);
  line(0, 52, width, 52);

  textAlign(LEFT, CENTER);
  textSize(16);
  textStyle(BOLD);
  fill(52, 211, 153);
  text(`Pontos: ${pontuacao}`, 16, 26);

  let heartX = 140;
  for (let i = 0; i < vidas; i++) {
    if (imgCoracao) {
      image(imgCoracao, heartX + i * 25, 15, 22, 22);
    } else {
      fill(239, 68, 68);
      text("♥", heartX + i * 22, 26);
    }
  }

  let min = floor(tempoDecorridoJogo / 60);
  let seg = tempoDecorridoJogo % 60;
  let tempoStr = nf(min, 2) + ":" + nf(seg, 2);
  fill(241, 245, 249);
  textSize(14);
  textStyle(NORMAL);
  text(`Tempo: ${tempoStr}`, 235, 26);

  let corNivel = nivelJogo === 1 ? color(52, 211, 153) : (nivelJogo === 2 ? color(56, 189, 248) : (nivelJogo === 3 ? color(251, 191, 36) : color(239, 68, 68)));
  fill(corNivel);
  textStyle(BOLD);
  text(`Fase ${nivelJogo}`, 350, 26);

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

  // vu-metro de som no topo usando a moldura da barra
  let mx = width - 195, my = 15, mw = 180, mh = 20;
  if (imgBarraAudio) {
    image(imgBarraAudio, mx, my, mw, mh);
  }
  let fillW = constrain(micLevel * (mw - 4) * 3.5, 0, mw - 4);
  fill(podeDispararAudio ? color(16, 185, 129) : color(245, 158, 11));
  noStroke();
  rect(mx + 2, my + 2, fillW, mh - 4, 4);

  // marcadores de histerese
  stroke(239, 68, 68);
  strokeWeight(2);
  let hx = mx + constrain(highThreshold * (mw - 4) * 3.5, 0, mw - 4);
  let lx = mx + constrain(lowThreshold * (mw - 4) * 3.5, 0, mw - 4);
  line(hx, my, hx, my + mh);
  stroke(251, 191, 36);
  line(lx, my, lx, my + mh);
  pop();
}

// cliques do rato servem apenas para os botoes dos menus
function mousePressed() {
  userStartAudio().then(() => {
    if (mic && !micIniciado) {
      mic.start(() => { micIniciado = true; });
    }
  });

  if (estadoAtual === ESTADO_INICIO) {
    let btnX = width / 2 - 120, btnY = 460, btnW = 240, btnH = 46;
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      estadoAtual = ESTADO_CALIBRACAO;
      framesCalibracao = 0;
      somaRuidoCalibracao = 0;
    }
  } else if (estadoAtual === ESTADO_FIM) {
    let btnX = width / 2 - 110, btnY = 380, btnW = 220, btnH = 46;
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      estadoAtual = ESTADO_JOGO;
      reiniciarDadosJogo();
    }
  }
}

// classes das entidades
class Planta {
  constructor(x, y, tipo) {
    this.x = x;
    this.y = y;
    this.tipo = tipo;
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
    let pulso = 1.0 + sin(frameCount * 0.05 + this.x) * 0.04;
    let d = this.diam * pulso;

    if (this.tipo === 'INVASORA') {
      if (imgInvasora) {
        image(imgInvasora, this.x, this.y, d, d);
      }
      noFill();
      let urgente = this.idade > this.tempoMaximo * 0.75;
      let alphaAlerta = urgente ? (sin(frameCount * 0.3) > 0 ? 255 : 60) : 120;
      stroke(239, 68, 68, alphaAlerta);
      strokeWeight(urgente ? 2.5 : 1.5);
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

    stroke(167, 243, 208, alpha * 1.5);
    strokeWeight(2);
    let subida = (1 - progresso) * 16;
    point(this.x - 8, this.y - subida);
    point(this.x + 8, this.y - subida * 1.1);
    pop();
  }
}

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

function desenhaMira(x, y) {
  push();
  imageMode(CENTER);
  let tamMira = temSuperLaser ? 48 : 34;

  if (imgMira) {
    if (temSuperLaser) {
      tint(251, 191, 36);
    }
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

function desenhaFundoTerreno() {
  if (imgCampo) {
    image(imgCampo, 0, 0, width, height);
  } else {
    background(25, 55, 35);
  }
}

function desenhaRodape() {
  push();
  // Barra translucida na base para contraste e leitura perfeita
  fill(10, 20, 15, 175);
  noStroke();
  rect(0, height - 28, width, 28);
  stroke(255, 255, 255, 30);
  strokeWeight(1);
  line(0, height - 28, width, height - 28);

  textSize(13);
  textStyle(BOLD);

  // Tema em branco bem visivel no canto esquerdo
  textAlign(LEFT, CENTER);
  noStroke();
  fill(255);
  text("Invasive Species Control", 16, height - 14);

  // Nome e numero em amarelo dourado bem legivel no canto direito
  textAlign(RIGHT, CENTER);
  fill(251, 191, 36);
  text("Luís Lopes, nº 25361, ECGM", width - 16, height - 14);
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
