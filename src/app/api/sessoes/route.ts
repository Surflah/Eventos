import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureSqliteWal } from '@/lib/prisma';
import { gerarIdSessaoBase, VereadorSessaoItem } from '@/core/regimento';
import { estadoPalcoPadrao } from '@/lib/sse';
import { extrairFolderIdDrive } from '@/services/comunicacao.service';
import { registrarAuditoria } from '@/lib/auth';

export async function GET(req: NextRequest) {
  await ensureSqliteWal();
  const incluirArquivadas = req.nextUrl.searchParams.get('arquivadas') === '1';

  const sessoes = await prisma.sessao.findMany({
    where: incluirArquivadas ? {} : { arquivada: false },
    orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
    include: {
      homenageados: {
        orderBy: { ordem: 'asc' },
        select: {
          id: true,
          nome: true,
          mocao: true,
          fotosJson: true,
          videoArquivo: true,
        },
      },
    },
  });

  const formatadas = sessoes.map((s) => {
    let totalFotos = 0;
    let totalVideos = 0;
    for (const h of s.homenageados) {
      try {
        const f = JSON.parse(h.fotosJson || '[]');
        if (Array.isArray(f)) totalFotos += f.length;
      } catch {
        // ignore
      }
      if (h.videoArquivo) totalVideos += 1;
    }
    return {
      id: s.id,
      titulo: s.titulo,
      numero: s.numero,
      local: s.local,
      data: s.data,
      hora: s.hora,
      presidente: s.presidente,
      arquivada: s.arquivada,
      totalHomenageados: s.homenageados.length,
      totalFotos,
      totalVideos,
    };
  });

  return NextResponse.json({ ok: true, sessoes: formatadas });
}

export async function POST(req: NextRequest) {
  try {
    await ensureSqliteWal();
    const body = await req.json();

    const titulo = String(body.titulo || 'Sessão Solene de Homenagens').trim();
    const numero = String(body.numero || '').trim();
    const data = String(body.data || '').trim();
    const hora = String(body.hora || '19:00').trim();
    const local = String(body.local || 'Plenário da Câmara Municipal de Itapoá').trim();
    const driveUrl = String(body.driveUrl || '').trim();

    if (!data) {
      return NextResponse.json({ ok: false, error: 'Informe a data da sessão.' }, { status: 400 });
    }

    const idBase = gerarIdSessaoBase(data, titulo);
    let idFinal = idBase;
    let sufixo = 2;
    while (await prisma.sessao.findUnique({ where: { id: idFinal } })) {
      idFinal = `${idBase}-${sufixo++}`;
    }

    // Carrega composição em exercício da Casa
    const vereadoresCasa = await prisma.vereador.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });

    const vereadoresSessao: VereadorSessaoItem[] = vereadoresCasa.map((v) => ({
      vereadorId: v.id,
      nome: v.nome,
      tratamento: v.tratamento,
      partido: v.partido,
      cargo: v.cargo,
      ordem: v.ordem,
      presente: true,
    }));

    const presMesa = vereadoresCasa.find((v) => /presidente/i.test(v.cargo)) || vereadoresCasa[0];
    const presidenteStr = presMesa
      ? `${presMesa.tratamento} ${presMesa.nome}${presMesa.partido ? ` (${presMesa.partido})` : ''}`
      : '';

    const sessao = await prisma.sessao.create({
      data: {
        id: idFinal,
        titulo,
        numero,
        local,
        data,
        hora,
        presidente: presidenteStr,
        driveUrl,
        driveId: extrairFolderIdDrive(driveUrl),
        vereadoresJson: JSON.stringify(vereadoresSessao),
        estadoPalcoJson: JSON.stringify(estadoPalcoPadrao(idFinal)),
      },
    });

    await registrarAuditoria({
      acao: 'CRIAR_SESSAO',
      entidade: 'Sessao',
      entidadeId: sessao.id,
      detalhes: `${titulo} (${data} ${hora})`,
    });

    return NextResponse.json({ ok: true, sessao });
  } catch (err) {
    console.error('Erro em POST /api/sessoes:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao criar sessão.' }, { status: 500 });
  }
}
