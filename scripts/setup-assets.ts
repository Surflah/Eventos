import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { PrismaClient } from '@prisma/client';

const ROOT = process.cwd();
const FONTS_DIR = path.join(ROOT, 'public', 'fonts');
const FUNDOS_DIR = path.join(ROOT, 'storage', 'fundos');
const TRILHAS_DIR = path.join(ROOT, 'storage', 'trilhas');

const FONT_URLS: Record<string, string> = {
  'Poppins-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf',
  'Poppins-SemiBold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-SemiBold.ttf',
  'Poppins-Bold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf',
  'PTSerif-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Regular.ttf',
  'PTSerif-Bold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Bold.ttf',
  'Cinzel-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf',
  'Cinzel-Bold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf',
  'PlayfairDisplay-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf',
  'PlayfairDisplay-Bold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf',
  'GreatVibes-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf',
};

async function baixarFontes() {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
  for (const [nome, url] of Object.entries(FONT_URLS)) {
    const dest = path.join(FONTS_DIR, nome);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10_000) continue;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
        console.log(`Fonte baixada: ${nome} (${buf.length} bytes)`);
      }
    } catch (e) {
      console.warn(`Aviso ao baixar fonte ${nome}:`, e);
    }
  }

  for (const nome of Object.keys(FONT_URLS)) {
    const p = path.join(FONTS_DIR, nome);
    if (fs.existsSync(p)) {
      const familia = nome.replace('.ttf', '');
      GlobalFonts.registerFromPath(p, familia);
    }
  }
}

async function gerarFundosPadrao() {
  fs.mkdirSync(FUNDOS_DIR, { recursive: true });
  const brasaoPath = path.join(ROOT, 'public', 'img', 'brasao-camara.png');
  const brasao = fs.existsSync(brasaoPath) ? await loadImage(brasaoPath) : null;

  // 1. Fundo de Convite & Convite Geral (1748 x 1240)
  for (const arq of ['convite.png', 'convite_geral.png']) {
    const destino = path.join(FUNDOS_DIR, arq);
    if (fs.existsSync(destino)) continue;
    const w = 1748;
    const h = 1240;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fcfaf5');
    grad.addColorStop(0.5, '#f7f3ea');
    grad.addColorStop(1, '#f1ebde');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Moldura dupla institucional azul e ouro
    ctx.strokeStyle = '#123f6b';
    ctx.lineWidth = 8;
    ctx.strokeRect(42, 42, w - 84, h - 84);

    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 3;
    ctx.strokeRect(58, 58, w - 116, h - 116);

    // Cantos ornamentais dourados
    const cantos = [
      [58, 58, 1, 1],
      [w - 58, 58, -1, 1],
      [58, h - 58, 1, -1],
      [w - 58, h - 58, -1, -1],
    ];
    ctx.strokeStyle = '#b8912f';
    ctx.lineWidth = 4;
    for (const [cx, cy, dx, dy] of cantos) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * 48);
      ctx.lineTo(cx + dx * 48, cy + dy * 48);
      ctx.lineTo(cx + dx * 48, cy);
      ctx.stroke();
    }

    if (brasao) {
      // Marca d'água suave ao centro
      ctx.save();
      ctx.globalAlpha = 0.045;
      ctx.drawImage(brasao, w / 2 - 260, h / 2 - 240, 520, 520);
      ctx.restore();

      // Brasão topo
      ctx.drawImage(brasao, w / 2 - 78, 95, 156, 156);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#123f6b';
    ctx.font = 'bold 38px Cinzel-Bold, serif';
    ctx.fillText('CÂMARA MUNICIPAL DE ITAPOÁ', w / 2, 305);

    ctx.fillStyle = '#94711c';
    ctx.font = '24px Poppins-SemiBold, sans-serif';
    ctx.fillText('PODER LEGISLATIVO • ESTADO DE SANTA CATARINA', w / 2, 344);

    // Linha divisória dourada
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 280, 378);
    ctx.lineTo(w / 2 + 280, 378);
    ctx.stroke();

    ctx.fillStyle = '#17568c';
    ctx.font = 'bold 44px PlayfairDisplay-Bold, serif';
    ctx.fillText('CONVITE OFICIAL', w / 2, 438);

    // Linha de assinatura do Presidente na base
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 250, 1050);
    ctx.lineTo(w / 2 + 250, 1050);
    ctx.stroke();

    fs.writeFileSync(destino, canvas.toBuffer('image/png'));
    console.log(`Fundo gerado: ${arq}`);
  }

  // 2. Fundo de Certificado da Moção (2000 x 1414)
  const certDest = path.join(FUNDOS_DIR, 'certificado.png');
  if (!fs.existsSync(certDest)) {
    const w = 2000;
    const h = 1414;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fdfbf7');
    grad.addColorStop(0.5, '#f8f4eb');
    grad.addColorStop(1, '#f2ecde');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Faixa lateral decorativa azul imperial e ouro
    ctx.strokeStyle = '#1b2f6b';
    ctx.lineWidth = 14;
    ctx.strokeRect(48, 48, w - 96, h - 96);

    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 4;
    ctx.strokeRect(70, 70, w - 140, h - 140);

    ctx.strokeStyle = '#1b2f6b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(82, 82, w - 164, h - 164);

    if (brasao) {
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.drawImage(brasao, w / 2 - 320, h / 2 - 280, 640, 640);
      ctx.restore();

      ctx.drawImage(brasao, w / 2 - 90, 112, 180, 180);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1b2f6b';
    ctx.font = 'bold 44px Cinzel-Bold, serif';
    ctx.fillText('CÂMARA MUNICIPAL DE ITAPOÁ', w / 2, 344);

    ctx.fillStyle = '#94711c';
    ctx.font = '24px Poppins-SemiBold, sans-serif';
    ctx.fillText('ESTADO DE SANTA CATARINA • PODER LEGISLATIVO', w / 2, 384);

    ctx.fillStyle = '#1b2f6b';
    ctx.font = 'bold 58px Cinzel-Bold, serif';
    ctx.fillText('MOÇÃO DE APLAUSOS E CONGRATULAÇÕES', w / 2, 474);

    ctx.fillStyle = '#4a5568';
    ctx.font = '27px PTSerif-Regular, serif';
    ctx.fillText('O Poder Legislativo Municipal de Itapoá confere a presente homenagem', w / 2, 540);

    // Linhas de assinatura na base esquerda/centro
    ctx.strokeStyle = '#1b2f6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(260, 1245);
    ctx.lineTo(760, 1245);
    ctx.moveTo(850, 1245);
    ctx.lineTo(1230, 1245);
    ctx.stroke();

    ctx.fillStyle = '#1b2f6b';
    ctx.font = '22px Poppins-SemiBold, sans-serif';
    ctx.fillText('Mesa Diretora • Câmara Municipal de Itapoá', 510, 1280);
    ctx.fillText('Vereador(a) Proponente', 1040, 1280);

    fs.writeFileSync(certDest, canvas.toBuffer('image/png'));
    console.log('Fundo gerado: certificado.png');
  }
}

async function gerarTrilhaInstrumentalPadrao() {
  fs.mkdirSync(TRILHAS_DIR, { recursive: true });
  const nomeArq = 'trilha-solene-institucional.wav';
  const dest = path.join(TRILHAS_DIR, nomeArq);
  if (!fs.existsSync(dest)) {
    const sampleRate = 22050;
    const durationSec = 16;
    const numSamples = sampleRate * durationSec;
    const buffer = Buffer.alloc(44 + numSamples * 2);

    // WAV PCM 16-bit mono header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    // Progressão suave de acordes solenes (C maj7 -> G6 -> Am7 -> F maj7) para loop perfeito
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [196.0, 246.94, 329.63, 392.0],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
    ];

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const chordIdx = Math.floor(t / 4) % chords.length;
      const localT = t % 4;
      const env = Math.sin((Math.PI * localT) / 4); // fade suave em cada compasso
      const notes = chords[chordIdx];
      let sample = 0;
      for (const f of notes) {
        sample += Math.sin(2 * Math.PI * f * t) * 0.16;
        sample += Math.sin(2 * Math.PI * f * 2 * t) * 0.04;
      }
      const val = Math.max(-1, Math.min(1, sample * (0.35 + 0.65 * env)));
      buffer.writeInt16LE(Math.round(val * 18000), 44 + i * 2);
    }
    fs.writeFileSync(dest, buffer);
    console.log('Trilha sonora solene gerada:', nomeArq);
  }

  const prisma = new PrismaClient();
  try {
    const stat = fs.statSync(dest);
    await prisma.trilhaAudio.upsert({
      where: { arquivo: nomeArq },
      create: {
        nome: 'Trilha Solene Institucional (Piano & Cordas Suaves)',
        arquivo: nomeArq,
        tamanho: stat.size,
      },
      update: { tamanho: stat.size },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await baixarFontes();
  await gerarFundosPadrao();
  await gerarTrilhaInstrumentalPadrao();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
