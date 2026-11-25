import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcularStatusPrazoMidia, formatarDataCurta } from '@/core/regimento';
import { registrarAuditoria } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token || token.length < 12) {
    return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 404 });
  }

  const h = await prisma.homenageado.findUnique({
    where: { uploadToken: token },
    include: { sessao: true },
  });

  if (!h) {
    return NextResponse.json({ ok: false, error: 'Link inválido.' }, { status: 404 });
  }

  const prazo = calcularStatusPrazoMidia(h.sessao.data, h.prazoReabertoAte);
  const fotos = JSON.parse(h.fotosJson || '[]') as Array<{ arquivo: string; nomeOriginal: string }>;

  return NextResponse.json({
    ok: true,
    dados: {
      sessaoTitulo: h.sessao.titulo,
      sessaoData: formatarDataCurta(h.sessao.data),
      sessaoHora: h.sessao.hora,
      homenageadoNome: h.nome,
      mocao: h.mocao,
      proponente: `${h.tratamentoProponente} ${h.proponente}`.trim(),
      vaiFalar: h.vaiFalar,
      representanteNome: h.representanteNome,
      representanteCargo: h.representanteCargo,
      fotos,
      temVideo: Boolean(h.videoArquivo),
      videoArquivo: h.videoArquivo,
      prazo,
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const h = await prisma.homenageado.findUnique({
      where: { uploadToken: token },
      include: { sessao: true },
    });

    if (!h) {
      return NextResponse.json({ ok: false, error: 'Link inválido.' }, { status: 404 });
    }

    const prazo = calcularStatusPrazoMidia(h.sessao.data, h.prazoReabertoAte);
    if (prazo.encerrado) {
      return NextResponse.json(
        {
          ok: false,
          error: `O prazo de envio encerrou na véspera da sessão (${prazo.ddMmVespera} às 23h59). Solicite ao Setor de Eventos caso precise de liberação excepcional.`,
        },
        { status: 403 }
      );
    }

    const contentType = req.headers.get('content-type') || '';

    // Atualização de confirmação de uso da palavra pelo gabinete/homenageado
    if (contentType.includes('application/json')) {
      const body = await req.json();
      await prisma.homenageado.update({
        where: { id: h.id },
        data: {
          vaiFalar: body.vaiFalar || h.vaiFalar,
          representanteNome:
            body.representanteNome !== undefined ? String(body.representanteNome) : h.representanteNome,
          representanteCargo:
            body.representanteCargo !== undefined ? String(body.representanteCargo) : h.representanteCargo,
        },
      });
      await registrarAuditoria({
        usuario: `portal:${h.proponente || h.nome}`,
        metodoAuth: 'token_publico',
        acao: 'CONFIRMAR_PRONUNCIAMENTO_EXTERNO',
        entidade: 'Homenageado',
        entidadeId: h.id,
      });
      return NextResponse.json({ ok: true });
    }

    // Upload de mídias (suporta chunks > 100 MB + fotos diretas)
    const form = await req.formData();
    const modoChunk = form.get('modoChunk') === '1';

    if (modoChunk) {
      const uploadId = String(form.get('uploadId') || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const chunkIndex = Number(form.get('chunkIndex') || 0);
      const totalChunks = Number(form.get('totalChunks') || 1);
      const fileName = String(form.get('fileName') || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
      const chunkBlob = form.get('chunk') as File | null;

      if (!uploadId || !chunkBlob) {
        return NextResponse.json({ ok: false, error: 'Parte de arquivo inválida.' }, { status: 400 });
      }

      const chunkDir = path.join(process.cwd(), 'storage', 'chunks', `pub_${uploadId}`);
      fs.mkdirSync(chunkDir, { recursive: true });
      fs.writeFileSync(
        path.join(chunkDir, `part_${String(chunkIndex).padStart(5, '0')}`),
        Buffer.from(await chunkBlob.arrayBuffer())
      );

      if (chunkIndex + 1 < totalChunks) {
        return NextResponse.json({ ok: true, parcial: true, chunkIndex });
      }

      const ehVideo = /\.(mp4|webm|mov|m4v)$/i.test(fileName);
      const sub = ehVideo ? 'video' : 'fotos';
      const destDir = path.join(process.cwd(), 'storage', 'midia', h.sessaoId, h.id, sub);
      fs.mkdirSync(destDir, { recursive: true });
      const nomeFinal = `${Date.now()}_${fileName}`;
      const finalPath = path.join(destDir, nomeFinal);

      const ws = fs.createWriteStream(finalPath);
      for (let i = 0; i < totalChunks; i++) {
        ws.write(fs.readFileSync(path.join(chunkDir, `part_${String(i).padStart(5, '0')}`)));
      }
      await new Promise<void>((resolve, reject) => {
        ws.end(() => resolve());
        ws.on('error', reject);
      });
      fs.rmSync(chunkDir, { recursive: true, force: true });

      const relUrl = `/midia/${h.sessaoId}/${h.id}/${sub}/${nomeFinal}`;
      if (ehVideo) {
        await prisma.homenageado.update({
          where: { id: h.id },
          data: { videoArquivo: relUrl },
        });
      } else {
        const fotos = JSON.parse(h.fotosJson || '[]');
        fotos.push({ arquivo: relUrl, nomeOriginal: fileName, origem: 'portal' });
        await prisma.homenageado.update({
          where: { id: h.id },
          data: { fotosJson: JSON.stringify(fotos) },
        });
      }

      await registrarAuditoria({
        usuario: `portal:${h.proponente || h.nome}`,
        metodoAuth: 'token_publico',
        acao: 'UPLOAD_EXTERNO_MIDIA',
        entidade: 'Homenageado',
        entidadeId: h.id,
        detalhes: fileName,
      });

      return NextResponse.json({ ok: true, concluido: true, url: relUrl });
    }

    const arquivos = form.getAll('arquivos') as File[];
    const fotosAtuais = JSON.parse(h.fotosJson || '[]');
    let videoAtual = h.videoArquivo;

    for (const file of arquivos) {
      if (!file?.name) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const mime = (file.type || '').toLowerCase();
      const ext = path.extname(file.name).toLowerCase();

      if (mime.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(ext)) {
        const dirF = path.join(process.cwd(), 'storage', 'midia', h.sessaoId, h.id, 'fotos');
        fs.mkdirSync(dirF, { recursive: true });
        fs.writeFileSync(path.join(dirF, safeName), buf);
        fotosAtuais.push({
          arquivo: `/midia/${h.sessaoId}/${h.id}/fotos/${safeName}`,
          nomeOriginal: file.name,
          origem: 'portal',
        });
      } else if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(ext)) {
        const dirV = path.join(process.cwd(), 'storage', 'midia', h.sessaoId, h.id, 'video');
        fs.mkdirSync(dirV, { recursive: true });
        fs.writeFileSync(path.join(dirV, safeName), buf);
        videoAtual = `/midia/${h.sessaoId}/${h.id}/video/${safeName}`;
      }
    }

    await prisma.homenageado.update({
      where: { id: h.id },
      data: {
        fotosJson: JSON.stringify(fotosAtuais),
        videoArquivo: videoAtual,
      },
    });

    await registrarAuditoria({
      usuario: `portal:${h.proponente || h.nome}`,
      metodoAuth: 'token_publico',
      acao: 'UPLOAD_EXTERNO_FOTOS',
      entidade: 'Homenageado',
      entidadeId: h.id,
      detalhes: `${arquivos.length} arquivo(s)`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro em /api/public/enviar/[token]:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao receber arquivos.' }, { status: 500 });
  }
}
