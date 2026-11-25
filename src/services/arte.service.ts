import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { formatarDataCurta, formatarDataExtenso, formatarHoraExtenso } from '@/core/regimento';

export interface BlocoModelo {
  rotulo: string;
  texto: string;
  x: number;
  y: number;
  largura: number;
  tamanho: number;
  entrelinha: number;
  fonte: string;
  align: 'center' | 'left' | 'right';
  ancora: 'topo' | 'meio';
  cor: string;
  cor_destaque: string;
  max_linhas: number;
  maiusculas: boolean;
  encolher: boolean;
  qr: string;
  icone: string;
  oculto: boolean;
}

export interface OverrideCertificado {
  ativo?: boolean;
  artigo?: string;
  nomeCompleto?: string;
  textoConcessao?: string;
}

let fontesRegistradas = false;

function garantirFontesRegistradas() {
  if (fontesRegistradas) return;
  const dir = path.join(process.cwd(), 'public', 'fonts');
  const lista = [
    'Poppins-Regular.ttf',
    'Poppins-SemiBold.ttf',
    'Poppins-Bold.ttf',
    'PTSerif-Regular.ttf',
    'PTSerif-Bold.ttf',
    'Cinzel-Regular.ttf',
    'Cinzel-Bold.ttf',
    'PlayfairDisplay-Regular.ttf',
    'PlayfairDisplay-Bold.ttf',
    'GreatVibes-Regular.ttf',
  ];
  for (const arq of lista) {
    const p = path.join(dir, arq);
    if (fs.existsSync(p)) {
      GlobalFonts.registerFromPath(p, arq.replace('.ttf', ''));
    }
  }
  fontesRegistradas = true;
}

function resolverFonteBold(fonteBase: string): string {
  if (fonteBase.endsWith('-Bold')) return fonteBase;
  if (fonteBase.startsWith('PTSerif')) return 'PTSerif-Bold';
  if (fonteBase.startsWith('Cinzel')) return 'Cinzel-Bold';
  if (fonteBase.startsWith('PlayfairDisplay')) return 'PlayfairDisplay-Bold';
  if (fonteBase.startsWith('Poppins')) return 'Poppins-Bold';
  return fonteBase;
}

interface TokenFormatado {
  texto: string;
  negrito: boolean;
  destaque: boolean;
}

function tokenizarFormatacaoInline(linha: string): TokenFormatado[] {
  // Suporta combinações de ##...## e **...**
  const tokens: TokenFormatado[] = [];
  let i = 0;
  let negrito = false;
  let destaque = false;
  let buffer = '';

  const flush = () => {
    if (buffer) {
      tokens.push({ texto: buffer, negrito, destaque });
      buffer = '';
    }
  };

  while (i < linha.length) {
    if (linha.slice(i, i + 2) === '**') {
      flush();
      negrito = !negrito;
      i += 2;
      continue;
    }
    if (linha.slice(i, i + 2) === '##') {
      flush();
      destaque = !destaque;
      i += 2;
      continue;
    }
    buffer += linha[i];
    i++;
  }
  flush();

  // Divide por espaços preservando os espaços para word-wrap exato
  const palavras: TokenFormatado[] = [];
  for (const tk of tokens) {
    const partes = tk.texto.split(/(\s+)/).filter((p) => p.length > 0);
    for (const p of partes) {
      palavras.push({ texto: p, negrito: tk.negrito, destaque: tk.destaque });
    }
  }
  return palavras;
}

function quebrarLinhasFormatadas(
  ctx: SKRSContext2D,
  textoBruto: string,
  larguraMaxPx: number,
  tamanhoPx: number,
  fonteRegular: string
): TokenFormatado[][] {
  const fonteBold = resolverFonteBold(fonteRegular);
  const paragrafos = textoBruto.split(/\r?\n/);
  const linhasFinais: TokenFormatado[][] = [];

  const medirToken = (tk: TokenFormatado) => {
    const fam = tk.negrito ? fonteBold : fonteRegular;
    const weight = tk.negrito && fam === fonteRegular ? 'bold ' : '';
    ctx.font = `${weight}${tamanhoPx}px "${fam}", serif`;
    return ctx.measureText(tk.texto).width;
  };

  for (const par of paragrafos) {
    if (!par.trim()) {
      linhasFinais.push([]);
      continue;
    }
    const tokens = tokenizarFormatacaoInline(par);
    let linhaAtual: TokenFormatado[] = [];
    let larguraAtual = 0;

    for (const tk of tokens) {
      const ehEspaco = /^\s+$/.test(tk.texto);
      if (ehEspaco && linhaAtual.length === 0) continue;

      const w = medirToken(tk);
      if (!ehEspaco && linhaAtual.length > 0 && larguraAtual + w > larguraMaxPx) {
        // Remove espaço final da linha anterior
        while (linhaAtual.length > 0 && /^\s+$/.test(linhaAtual[linhaAtual.length - 1].texto)) {
          linhaAtual.pop();
        }
        linhasFinais.push(linhaAtual);
        linhaAtual = [tk];
        larguraAtual = w;
      } else {
        linhaAtual.push(tk);
        larguraAtual += w;
      }
    }

    while (linhaAtual.length > 0 && /^\s+$/.test(linhaAtual[linhaAtual.length - 1].texto)) {
      linhaAtual.pop();
    }
    if (linhaAtual.length > 0) linhasFinais.push(linhaAtual);
  }

  return linhasFinais;
}

function desenharIconeVetorial(
  ctx: SKRSContext2D,
  tipo: string,
  x: number,
  y: number,
  tam: number,
  cor: string
) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = Math.max(2, tam * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tipo === 'calendario') {
    const r = tam * 0.14;
    ctx.strokeRect(x, y + tam * 0.12, tam * 0.86, tam * 0.78);
    ctx.beginPath();
    ctx.moveTo(x, y + tam * 0.34);
    ctx.lineTo(x + tam * 0.86, y + tam * 0.34);
    ctx.moveTo(x + tam * 0.24, y);
    ctx.lineTo(x + tam * 0.24, y + tam * 0.22);
    ctx.moveTo(x + tam * 0.62, y);
    ctx.lineTo(x + tam * 0.62, y + tam * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + tam * 0.43, y + tam * 0.58, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (tipo === 'relogio') {
    const cx = x + tam * 0.43;
    const cy = y + tam * 0.46;
    const raio = tam * 0.41;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - raio * 0.55);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + raio * 0.42, cy + raio * 0.22);
    ctx.stroke();
  } else if (tipo === 'local') {
    const cx = x + tam * 0.43;
    const cy = y + tam * 0.36;
    const raio = tam * 0.31;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, Math.PI, 0, false);
    ctx.quadraticCurveTo(cx + raio, cy + raio * 1.1, cx, y + tam * 0.92);
    ctx.quadraticCurveTo(cx - raio, cy + raio * 1.1, cx - raio, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function montarDicionarioMarcadores(params: {
  sessao: {
    titulo: string;
    data: string;
    hora: string;
    local: string;
    presidente: string;
  };
  homenageado?: {
    nome: string;
    qualificacao: string;
    comoChamar: string;
    mocao: string;
    dataAprovacao: string;
    proponente: string;
    tratamentoProponente: string;
    partidoProponente: string;
    feito: string;
    mocaoPdfUrl: string;
  } | null;
  todosHomenageados?: { nome: string }[];
}): Record<string, string> {
  const { sessao, homenageado, todosHomenageados = [] } = params;
  const presLimpo = (sessao.presidente || 'Presidente da Câmara')
    .replace(/^Vereador(a)?\s+/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();

  const nomesDestaque = todosHomenageados.map((h) => `##**${h.nome}**##`);
  const listaDestaque =
    nomesDestaque.length > 1
      ? `${nomesDestaque.slice(0, -1).join(', ')} e ${nomesDestaque[nomesDestaque.length - 1]}`
      : nomesDestaque[0] || 'nossos homenageados';

  const h = homenageado;
  const nomeCompleto = h ? (h.qualificacao ? `${h.nome} — ${h.qualificacao}` : h.nome) : '';
  const ehFem = h?.tratamentoProponente === 'Vereadora';

  return {
    '{nome}': h?.nome || '',
    '{titulo}': h?.qualificacao || '',
    '{nome_completo}': h?.nome || nomeCompleto,
    '{artigo}': h?.comoChamar || 'ao',
    '{mocao}': h?.mocao || '',
    '{proponente}': h?.proponente || '',
    '{do_proponente}': ehFem ? 'da' : 'do',
    '{tratamento_proponente}': h?.tratamentoProponente || 'Vereador',
    '{partido_proponente}': h?.partidoProponente || '',
    '{data_aprovacao}': h?.dataAprovacao || formatarDataCurta(sessao.data),
    '{motivo}': h?.feito || 'pelos relevantes serviços prestados à comunidade de Itapoá',
    '{data_extenso}': formatarDataExtenso(sessao.data, true),
    '{data}': formatarDataCurta(sessao.data),
    '{hora}': sessao.hora || '19:00',
    '{hora_extenso}': formatarHoraExtenso(sessao.hora || '19:00'),
    '{presidente}': presLimpo,
    '{casa}': 'Câmara Municipal de Itapoá',
    '{municipio}': 'Itapoá - SC',
    '{mocao_pdf}': h?.mocaoPdfUrl || 'https://sapl.itapoa.sc.leg.br',
    '{lista_destaque}': listaDestaque,
  };
}

function aplicarMarcadores(template: string, dict: Record<string, string>): string {
  let res = template || '';
  for (const [k, v] of Object.entries(dict)) {
    res = res.split(k).join(v);
  }
  return res;
}

export async function renderizarArtePng(params: {
  codigoModelo: 'convite' | 'certificado' | 'convite_geral';
  larguraPx: number;
  alturaPx: number;
  fundoPath: string | null;
  blocos: BlocoModelo[];
  marcadores: Record<string, string>;
  overrideCertificado?: OverrideCertificado | null;
  larguraSaidaPx?: number;
}): Promise<Buffer> {
  garantirFontesRegistradas();

  const w = params.larguraPx || 1748;
  const h = params.alturaPx || 1240;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // 1. Desenha arte de fundo
  ctx.fillStyle = '#faf7f0';
  ctx.fillRect(0, 0, w, h);

  if (params.fundoPath && fs.existsSync(params.fundoPath)) {
    const imgFundo = await loadImage(params.fundoPath);
    ctx.drawImage(imgFundo, 0, 0, w, h);
  }

  // 2. Aplica override individual do certificado se ativo
  const blocosEfetivos = params.blocos.map((b, idx) => {
    if (params.codigoModelo === 'certificado' && params.overrideCertificado?.ativo) {
      if (idx === 0 && params.overrideCertificado.artigo !== undefined) {
        return { ...b, texto: params.overrideCertificado.artigo };
      }
      if (idx === 1 && params.overrideCertificado.nomeCompleto !== undefined) {
        return { ...b, texto: params.overrideCertificado.nomeCompleto };
      }
      if (idx === 2 && params.overrideCertificado.textoConcessao !== undefined) {
        return { ...b, texto: params.overrideCertificado.textoConcessao };
      }
    }
    return b;
  });

  // 3. Renderiza cada bloco
  for (const bloco of blocosEfetivos) {
    if (bloco.oculto) continue;

    const pxX = (Number(bloco.x) || 0) * w;
    const pxY = (Number(bloco.y) || 0) * h;
    const maxLarg = Math.max(40, (Number(bloco.largura) || 0.7) * w);
    let fontSize = Math.max(10, (Number(bloco.tamanho) || 0.028) * h);

    // 3a. Ícone vetorial
    if (bloco.icone && bloco.icone !== '(nenhum, é texto)') {
      desenharIconeVetorial(ctx, bloco.icone, pxX, pxY, fontSize, bloco.cor || '#12263a');
      continue;
    }

    // 3b. QR Code
    if (bloco.qr && bloco.qr.trim()) {
      const conteudoQr = aplicarMarcadores(bloco.qr.trim(), params.marcadores);
      if (conteudoQr) {
        const qrTam = Math.round(Math.max(64, (Number(bloco.tamanho) || 0.115) * h));
        const qrDataUrl = await QRCode.toDataURL(conteudoQr, {
          margin: 1,
          width: qrTam,
          color: { dark: bloco.cor || '#1b2f6b', light: '#ffffff00' },
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, pxX, pxY, qrTam, qrTam);
      }
      continue;
    }

    // 3c. Bloco de texto rico
    let textoResolvido = aplicarMarcadores(bloco.texto || '', params.marcadores);
    if (!textoResolvido.trim()) continue;
    if (bloco.maiusculas) textoResolvido = textoResolvido.toUpperCase();

    const fonteReg = bloco.fonte || 'PTSerif-Regular';
    const fonteBold = resolverFonteBold(fonteReg);
    const maxLinhas = Math.max(1, Number(bloco.max_linhas) || 4);

    let linhas = quebrarLinhasFormatadas(ctx, textoResolvido, maxLarg, fontSize, fonteReg);
    if (bloco.encolher) {
      let tentativas = 0;
      const minSize = fontSize * 0.45;
      while (linhas.length > maxLinhas && fontSize > minSize && tentativas < 18) {
        fontSize *= 0.92;
        linhas = quebrarLinhasFormatadas(ctx, textoResolvido, maxLarg, fontSize, fonteReg);
        tentativas++;
      }
    }
    if (linhas.length > maxLinhas) {
      linhas = linhas.slice(0, maxLinhas);
    }

    const alturaLinha = fontSize * (Number(bloco.entrelinha) || 1.25);
    const alturaTotalBloco = linhas.length * alturaLinha;
    const inicioY =
      bloco.ancora === 'meio' ? pxY - alturaTotalBloco / 2 + fontSize * 0.82 : pxY + fontSize * 0.85;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    linhas.forEach((tokensLinha, idxLinha) => {
      const yLinha = inicioY + idxLinha * alturaLinha;
      // Mede largura total da linha
      const larguras = tokensLinha.map((tk) => {
        const fam = tk.negrito ? fonteBold : fonteReg;
        ctx.font = `${fontSize}px "${fam}", serif`;
        return ctx.measureText(tk.texto).width;
      });
      const somaLargura = larguras.reduce((a, b) => a + b, 0);

      let cursorX = pxX;
      if (bloco.align === 'center') cursorX = pxX - somaLargura / 2;
      else if (bloco.align === 'right') cursorX = pxX - somaLargura;

      tokensLinha.forEach((tk, idxTk) => {
        const fam = tk.negrito ? fonteBold : fonteReg;
        ctx.font = `${fontSize}px "${fam}", serif`;
        ctx.fillStyle = tk.destaque ? bloco.cor_destaque || bloco.cor || '#17568c' : bloco.cor || '#12263a';
        ctx.fillText(tk.texto, cursorX, yLinha);
        cursorX += larguras[idxTk];
      });
    });
  }

  // Redimensiona se solicitada miniatura (?w=420)
  if (params.larguraSaidaPx && params.larguraSaidaPx > 40 && params.larguraSaidaPx < w) {
    const outW = Math.round(params.larguraSaidaPx);
    const outH = Math.round((h * outW) / w);
    const thumb = createCanvas(outW, outH);
    const tctx = thumb.getContext('2d');
    tctx.drawImage(canvas, 0, 0, outW, outH);
    return thumb.toBuffer('image/png');
  }

  return canvas.toBuffer('image/png');
}

const DIMENSOES_PAPEL_PT: Record<string, [number, number]> = {
  'A4-paisagem': [841.89, 595.28],
  'A4-retrato': [595.28, 841.89],
  'A5-paisagem': [595.28, 419.53],
  'A5-retrato': [419.53, 595.28],
};

export async function gerarPdfDePngs(pngBuffers: Buffer[], papel = 'A4-paisagem'): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const [pageW, pageH] = DIMENSOES_PAPEL_PT[papel] || DIMENSOES_PAPEL_PT['A4-paisagem'];

  for (const buf of pngBuffers) {
    const img = await pdf.embedPng(buf);
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(img, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
