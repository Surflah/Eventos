import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
};

function resolverCaminhoSeguro(partes: string[]): string | null {
  if (!partes || partes.length === 0) return null;
  const limpas = partes.filter((p) => p && p !== '.' && p !== '..' && !p.includes('..'));
  if (limpas.length !== partes.length) return null;

  const raizStorage = path.join(process.cwd(), 'storage');
  if (limpas[0] === '_fundos') {
    return path.join(raizStorage, 'fundos', ...limpas.slice(1));
  }
  if (limpas[0] === '_trilhas') {
    return path.join(raizStorage, 'trilhas', ...limpas.slice(1));
  }
  return path.join(raizStorage, 'midia', ...limpas);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ caminho: string[] }> }
) {
  const { caminho } = await context.params;
  const fullPath = resolverCaminhoSeguro(caminho);

  if (!fullPath || !fs.existsSync(fullPath)) {
    return new NextResponse('Arquivo não encontrado', { status: 404 });
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    return new NextResponse('Caminho inválido', { status: 400 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const fileSize = stat.size;
  const range = req.headers.get('range');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 4 * 1024 * 1024 - 1, fileSize - 1);

    if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunkLength = end - start + 1;
    const nodeStream = fs.createReadStream(fullPath, { start, end });
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkLength),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const buf = fs.readFileSync(fullPath);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(fileSize),
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
