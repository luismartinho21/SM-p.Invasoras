// ecra inicial com instrucoes usando o cartao visual
function desenhaEcraInicio() {
  desenhaFundoTerreno();

  // cartao visual com as especies e controlos
  if (imgCardInicio) {
    image(imgCardInicio, width / 2 - 350, 45, 700, 480);
  }

  // barra para testar o som do microfone no menu
  desenhaBarraMicrofone(width / 2, 425);

  // botao iniciar
  let btnX = width / 2 - 120, btnY = 460, btnW = 240, btnH = 46;
  let hover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
  push();
  fill(hover ? color(16, 185, 129) : color(5, 150, 105));
  stroke(hover ? color(255) : color(52, 211, 153));
  strokeWeight(2);
  rect(btnX, btnY, btnW, btnH, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(17);
  textStyle(BOLD);
  text("INICIAR CALIBRAÇÃO", width / 2, btnY + btnH / 2);
  pop();

  desenhaRodape();
}

// barra para testar o som usando a imagem da moldura
function desenhaBarraMicrofone(cx, cy) {
  let w = 280, h = 20;
  let x = cx - w / 2;

  // moldura grafica em imagem
  if (imgBarraAudio) {
    image(imgBarraAudio, x, cy - 10, w, h);
  }

  // preenchimento em codigo conforme o volume
  let preenchimento = constrain(micLevel * (w - 4) * 3.5, 0, w - 4);
  push();
  noStroke();
  fill(micIniciado ? (micLevel > highThreshold ? color(239, 68, 68) : color(16, 185, 129)) : color(100));
  rect(x + 2, cy - 8, preenchimento, h - 4, 4);

  textAlign(CENTER, BOTTOM);
  textSize(11);
  fill(148, 163, 184);
  text(micIniciado ? `Microfone Ativo: ${(micLevel * 100).toFixed(1)}%` : "Clique abaixo para ligar o microfone", cx, cy - 12);
  pop();
}

// ecra de calibracao usando o cartao visual
function desenhaEcraCalibracao() {
  desenhaFundoTerreno();

  let cardX = width / 2 - 300, cardY = 140;
  if (imgCardCalibracao) {
    image(imgCardCalibracao, cardX, cardY, 600, 320);
  }

  framesCalibracao++;
  somaRuidoCalibracao += micLevel;

  // barra de progresso simples
  let progresso = framesCalibracao / TOTAL_FRAMES_CALIBRACAO;
  push();
  noStroke();
  fill(16, 185, 129);
  rect(cardX + 82, cardY + 132, (600 - 164) * progresso, 20, 10);

  fill(203, 213, 225);
  textAlign(CENTER, TOP);
  textSize(14);
  text(`Ruído Amostrado: ${(micLevel * 100).toFixed(1)}%`, width / 2, cardY + 175);
  pop();

  if (framesCalibracao >= TOTAL_FRAMES_CALIBRACAO) {
    ruidoAmbiente = somaRuidoCalibracao / TOTAL_FRAMES_CALIBRACAO;
    highThreshold = max(ruidoAmbiente * 2.2 + 0.045, 0.075);
    lowThreshold = max(ruidoAmbiente * 1.25 + 0.015, 0.03);

    if (somFundo && !musicaIniciada) {
      somFundo.loop();
      musicaIniciada = true;
    }

    estadoAtual = ESTADO_JOGO;
    reiniciarDadosJogo();
  }

  desenhaRodape();
}
