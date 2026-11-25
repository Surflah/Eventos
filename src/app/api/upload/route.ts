import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extrairTextoLimpoPdfMocao } from '@/services/sapl.service';
import { registrarAuditoria } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const sessaoId = String(form.get('sessaoId') || '');
    const hid = String(form.get('hid') || '');
    const modoChunk = form.get('modoChunk') === '1';

    const h = await prisma.homenageado.findFirst({
      where: { id: hid, sessaoId },
    });
    if (!h) {
      return NextResponse.json({ ok: false, error: 'Homenageado não encontrado.' }, { status: 404 });
    }

    // Upload fatiado (chunked) para vídeos > 100 MB (contornando limite do Cloudflare)
    if (modoChunk) {
      const uploadId = String(form.get('uploadId') || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const chunkIndex = Number(form.get('chunkIndex') || 0);
      const totalChunks = Number(form.get('totalChunks') || 1);
      const fileName = String(form.get('fileName') || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
      const chunkBlob = form.get('chunk') as File | null;

      if (!uploadId || !chunkBlob) {
        return NextResponse.json({ ok: false, error: 'Chunk inválido.' }, { status: 400 });
      }

      const chunkDir = path.join(process.cwd(), 'storage', 'chunks', uploadId);
      fs.mkdirSync(chunkDir, { recursive: true });
      const partPath = path.join(chunkDir, `part_${String(chunkIndex).padStart(5, '0')}`);
      fs.writeFileSync(partPath, Buffer.from(await chunkBlob.arrayBuffer()));

      if (chunkIndex + 1 < totalChunks) {
        return NextResponse.json({ ok: true, parcial: true, chunkIndex });
      }

      // Última parte: remonta arquivo final
      const ehVideo = /\.(mp4|webm|mov|m4v)$/i.test(fileName);
      const subpasta = ehVideo ? 'video' : 'fotos';
      const destDir = path.join(process.cwd(), 'storage', 'midia', sessaoId, hid, subpasta);
      fs.mkdirSync(destDir, { recursive: true });
      const nomeFinal = `${Date.now()}_${fileName}`;
      const finalPath = path.join(destDir, nomeFinal);

      const writeStream = fs.createWriteStream(finalPath);
      for (let i = 0; i < totalChunks; i++) {
        const p = path.join(chunkDir, `part_${String(i).padStart(5, '0')}`);
        writeStream.write(fs.readFileSync(p));
      }
      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve());
        writeStream.on('error', reject);
      });
      fs.rmSync(chunkDir, { recursive: true, force: true });

      const relUrl = `/midia/${sessaoId}/${hid}/${subpasta}/${nomeFinal}`;
      if (ehVideo) {
        await prisma.homenageado.update({
          where: { id: hid },
          data: { videoArquivo: relUrl },
        });
      } else {
        const fotos = JSON.parse(h.fotosJson || '[]');
        fotos.push({ arquivo: relUrl, nomeOriginal: fileName, origem: 'painel' });
        await prisma.homenageado.update({
          where: { id: hid },
          data: { fotosJson: JSON.stringify(fotos) },
        });
      }

      await registrarAuditoria({
        acao: 'UPLOAD_MIDIA_CHUNKED',
        entidade: 'Homenageado',
        entidadeId: hid,
        detalhes: fileName,
      });

      return NextResponse.json({ ok: true, concluido: true, url: relUrl });
    }

    // Upload múltiplo padrão (fotos, vídeos curtos e PDF da moção com extração instantânea)
    const arquivos = form.getAll('arquivos') as File[];
    const fotosAtuais: Array<{ arquivo: string; nomeOriginal: string; origem?: string }> = JSON.parse(
      h.fotosJson || '[]'
    );
    let videoAtual = h.videoArquivo;
    let textoMocaoExtraido = h.textoMocao;
    let fotosAdicionadas = 0;
    let pdfExtraido = false;

    for (const file of arquivos) {
      if (!file || !file.name) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const mime = (file.type || '').toLowerCase();
      const ext = path.extname(file.name).toLowerCase();

      if (mime === 'application/pdf' || ext === '.pdf') {
        const texto = await extrairTextoLimpoPdfMocao(buf);
        if (texto) {
          textoMocaoExtraido = texto;
          pdfExtraido = true;
        }
        continue;
      }

      if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(ext)) {
        const dirV = path.join(process.cwd(), 'storage', 'midia', sessaoId, hid, 'video');
        fs.mkdirSync(dirV, { recursive: true });
        fs.writeFileSync(path.join(dirV, safeName), buf);
        videoAtual = `/midia/${sessaoId}/${hid}/video/${safeName}`;
        continue;
      }

      if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(ext)) {
        const dirF = path.join(process.cwd(), 'storage', 'midia', sessaoId, hid, 'fotos');
        fs.mkdirSync(dirF, { recursive: true });
        fs.writeFileSync(path.join(dirF, safeName), buf);
        fotosAtuais.push({
          arquivo: `/midia/${sessaoId}/${hid}/fotos/${safeName}`,
          nomeOriginal: file.name,
          origem: 'painel',
        });
        fotosAdicionadas++;
      }
    }

    await prisma.homenageado.update({
      where: { id: hid },
      data: {
        fotosJson: JSON.stringify(fotosAtuais),
        videoArquivo: videoAtual,
        textoMocao: textoMocaoExtraido,
      },
    });

    await registrarAuditoria({
      acao: 'UPLOAD_MIDIA_PAINEL',
      entidade: 'Homenageado',
      entidadeId: hid,
      detalhes: `${fotosAdicionadas} foto(s)${pdfExtraido ? ' + PDF extraído' : ''}`,
    });

    return NextResponse.json({
      ok: true,
      fotosAdicionadas,
      pdfExtraido,
    });
  } catch (err) {
    console.error('Erro em POST /api/upload:', err);
    return NextResponse.json({ ok: false, error: 'Falha ao processar envio.' }, { status: 500 });
  }
}
