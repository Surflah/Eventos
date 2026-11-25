import fs from 'fs';
import path from 'path';
import { loadImage } from '@napi-rs/canvas';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get('m') || 'convite';
  const modelos = await prisma.modeloArte.findMany();
  const atual = modelos.find((m) => m.codigo === codigo) || modelos[0];
  return NextResponse.json({
    ok: true,
    modelo: atual
      ? {
          ...atual,
          blocos: JSON.parse(atual.blocosJson || '[]'),
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const codigo = String(form.get('codigo') || 'convite');
      const arq = form.get('fundo') as File | null;
      if (!arq || !arq.name) {
        return NextResponse.json({ ok: false, error: 'Selecione uma imagem.' }, { status: 400 });
      }
      const buf = Buffer.from(await arq.arrayBuffer());
      const img = await loadImage(buf);

      const dir = path.join(process.cwd(), 'storage', 'fundos');
      fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(arq.name).toLowerCase() || '.png';
      const fileName = `${codigo}_custom_${Date.now()}${ext}`;
      fs.writeFileSync(path.join(dir, fileName), buf);

      const fundoUrl = `/midia/_fundos/${fileName}`;
      await prisma.modeloArte.update({
        where: { codigo },
        data: {
          fundoUrl,
          larguraPx: img.width,
          alturaPx: img.height,
        },
      });

      await registrarAuditoria({
        acao: 'UPLOAD_FUNDO_MODELO',
        entidade: 'ModeloArte',
        entidadeId: codigo,
        detalhes: `${fileName} (${img.width}x${img.height})`,
      });

      return NextResponse.json({
        ok: true,
        fundoUrl,
        larguraPx: img.width,
        alturaPx: img.height,
      });
    }

    const body = await req.json();
    const codigo = String(body.codigo || 'convite');
    const papel = String(body.papel || 'A5-paisagem');
    const blocos = Array.isArray(body.blocos) ? body.blocos : [];

    await prisma.modeloArte.update({
      where: { codigo },
      data: {
        papel,
        blocosJson: JSON.stringify(blocos),
      },
    });

    await registrarAuditoria({
      acao: 'SALVAR_MODELO_ARTE',
      entidade: 'ModeloArte',
      entidadeId: codigo,
      detalhes: `${blocos.length} bloco(s), papel ${papel}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro em POST /api/modelos:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao salvar modelo.' }, { status: 500 });
  }
}
