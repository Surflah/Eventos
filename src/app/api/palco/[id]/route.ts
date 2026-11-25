import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoPalco, estadoPalcoPadrao, publicarPalco } from '@/lib/sse';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const sessao = await prisma.sessao.findUnique({
    where: { id },
    select: { estadoPalcoJson: true },
  });
  if (!sessao) {
    return NextResponse.json({ ok: false, error: 'Sessão não encontrada.' }, { status: 404 });
  }

  const base = estadoPalcoPadrao(id);
  let estado = base;
  try {
    const parsed = JSON.parse(sessao.estadoPalcoJson || '{}');
    estado = { ...base, ...parsed, sessao: id };
  } catch {
    estado = base;
  }

  return NextResponse.json({ ok: true, estado });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const sessao = await prisma.sessao.findUnique({
      where: { id },
      select: { estadoPalcoJson: true },
    });
    if (!sessao) {
      return NextResponse.json({ ok: false, error: 'Sessão não encontrada.' }, { status: 404 });
    }

    const base = estadoPalcoPadrao(id);
    let atual: EstadoPalco = base;
    try {
      atual = { ...base, ...JSON.parse(sessao.estadoPalcoJson || '{}') };
    } catch {
      atual = base;
    }

    const novoEstado: EstadoPalco = {
      ...atual,
      ...body,
      sessao: id,
      ts: Date.now(),
    };

    await prisma.sessao.update({
      where: { id },
      data: { estadoPalcoJson: JSON.stringify(novoEstado) },
    });

    publicarPalco(id, novoEstado);
    return NextResponse.json({ ok: true, estado: novoEstado });
  } catch (err) {
    console.error('Erro em POST /api/palco/[id]:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao atualizar palco.' }, { status: 500 });
  }
}
