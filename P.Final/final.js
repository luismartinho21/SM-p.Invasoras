// ecra de fim de jogo com resumo
function desenhaEcraFim() {
  desenhaFundoTerreno();

  // desenha o cartao visual de fim
  if (imgCardFim) {
    image(imgCardFim, width / 2 - 320, 65, 640, 440);
  }

  push();
  textAlign(CENTER, TOP);

  // pontuacao em destaque
  fill(52, 211, 153);
  textSize(34);
  textStyle(BOLD);
  text(`${pontuacao} PONTOS`, width / 2, 175);

  // estatisticas resumidas sem texto excessivo
  fill(226, 232, 240);
  textSize(16);
  textStyle(NORMAL);
  let min = floor(tempoDecorridoJogo / 60);
  let seg = tempoDecorridoJogo % 60;
  text(`Tempo: ${nf(min, 2)}m ${nf(seg, 2)}s   •   Fase Alcançada: ${nivelJogo}`, width / 2, 230);

  fill(203, 213, 225);
  textSize(15);
  text(`Invasoras Eliminadas: ${invasorasEliminadas}   •   Nativas Atingidas: ${nativasAtingidas}`, width / 2, 268);

  fill(251, 191, 36);
  text(`Combos de Super Laser Ativados: ${combosAtivados}`, width / 2, 305);

  // botao repetir
  let btnX = width / 2 - 110, btnY = 380, btnW = 220, btnH = 46;
  let hover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
  fill(hover ? color(59, 130, 246) : color(37, 99, 235));
  stroke(hover ? color(255) : color(96, 165, 250));
  strokeWeight(2);
  rect(btnX, btnY, btnW, btnH, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(17);
  textStyle(BOLD);
  text("REPETIR EXERCÍCIO", width / 2, btnY + btnH / 2);
  pop();

  desenhaRodape();
}
