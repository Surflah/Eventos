import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auth';

export async function GET() {
  const contatos = await prisma.contatoCasa.findMany({
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  return NextResponse.json({ ok: true, contatos });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lista: Array<{
      id?: number;
      nome: string;
      cargo: string;
      email: string;
      grupo: string;
      partido: string;
      obs: string;
      selecionado?: boolean;
      ordem?: number;
    }> = Array.isArray(body.contatos) ? body.contatos : [];

    const validos = lista.filter((c) => c.nome?.trim() && c.email?.trim());

    await prisma.$transaction([
      prisma.contatoCasa.deleteMany({}),
      prisma.contatoCasa.createMany({
        data: validos.map((c, idx) => ({
          nome: c.nome.trim(),
          cargo: (c.cargo || '').trim(),
          email: c.email.trim().toLowerCase(),
          grupo: (c.grupo || 'Servidores e setores').trim(),
          partido: (c.partido || '').trim(),
          obs: (c.obs || '').trim(),
          selecionado: c.selecionado !== false,
          ordem: idx + 1,
        })),
      }),
    ]);

    await registrarAuditoria({
      acao: 'SALVAR_CONTATOS_CASA',
      entidade: 'ContatoCasa',
      detalhes: `${validos.length} contato(s) salvo(s)`,
    });

    const atualizados = await prisma.contatoCasa.findMany({
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
    return NextResponse.json({ ok: true, contatos: atualizados });
  } catch (err) {
    console.error('Erro em POST /api/contatos:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao salvar contatos.' }, { status: 500 });
  }
}
