import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gerarHid, gerarTokenSeguro } from '@/lib/crypto';
import { registrarAuditoria } from '@/lib/auth';
import {
  extrairTextoLimpoPdfMocao,
  iniciarConsultaFilaSapl,
  obterProgressoJobSapl,
} from '@/services/sapl.service';

export async function GET(req: NextRequest) {
  const acao = req.nextUrl.searchParams.get('a') || 'aquecer';
  if (acao === 'progresso') {
    const jobId = req.nextUrl.searchParams.get('jobId') || '';
    const job = obterProgressoJobSapl(jobId);
    if (!job) {
      return NextResponse.json({ ok: false, error: 'Consulta não encontrada.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, job });
  }

  const anoAtual = new Date().getFullYear();
  const ano = Number(req.nextUrl.searchParams.get('ano') || anoAtual);
  const atualizar = req.nextUrl.searchParams.get('atualizar') === '1';
  const job = iniciarConsultaFilaSapl(ano, atualizar);
  return NextResponse.json({ ok: true, job });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const acao = String(body.acao || '');

    if (acao === 'devolver_fila') {
      const saplMateriaId = Number(body.saplMateriaId);
      const ano = Number(body.ano || new Date().getFullYear());
      await prisma.mocaoEntregueSapl.upsert({
        where: { saplMateriaId },
        create: {
          saplMateriaId,
          numero: Number(body.numero || 0),
          ano,
          devolvidaFila: true,
        },
        update: { devolvidaFila: true, sessaoId: null },
      });
      iniciarConsultaFilaSapl(ano, true);
      await registrarAuditoria({
        acao: 'DEVOLVER_MOCAO_FILA',
        entidade: 'MocaoSapl',
        entidadeId: saplMateriaId,
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'importar') {
      const sessaoId = String(body.sessaoId || '');
      const baixarPdf = Boolean(body.baixarPdf ?? true);
      const itens: Array<{
        saplMateriaId: number;
        numero: number;
        ano: number;
        mocaoFormatada: string;
        dataAprovacao: string;
        homenageado: string;
        comoChamar: string;
        motivo: string;
        proponenteNome: string;
        tratamentoProponente: string;
        partidoProponente: string;
        emailGabinete: string;
        pdfUrl: string;
      }> = Array.isArray(body.itens) ? body.itens : [];

      const sessao = await prisma.sessao.findUnique({
        where: { id: sessaoId },
        include: { homenageados: true },
      });
      if (!sessao) {
        return NextResponse.json({ ok: false, error: 'Sessão não encontrada.' }, { status: 404 });
      }

      let proximaOrdem =
        sessao.homenageados.reduce((max, h) => Math.max(max, h.ordem), 0) + 1;

      let importados = 0;
      for (const it of itens) {
        // Evita duplicar a mesma matéria na mesma sessão
        if (sessao.homenageados.some((h) => h.saplMateriaId === it.saplMateriaId)) {
          continue;
        }

        let textoMocao = '';
        if (baixarPdf && it.pdfUrl) {
          textoMocao = await extrairTextoLimpoPdfMocao(it.pdfUrl);
        }

        const hid = gerarHid();
        await prisma.homenageado.create({
          data: {
            id: hid,
            sessaoId: sessao.id,
            ordem: proximaOrdem++,
            saplMateriaId: it.saplMateriaId,
            mocao: it.mocaoFormatada,
            dataAprovacao: it.dataAprovacao || '',
            mocaoPdfUrl: it.pdfUrl || '',
            nome: it.homenageado.trim() || `Moção ${it.mocaoFormatada}`,
            comoChamar: it.comoChamar || 'ao',
            proponente: it.proponenteNome || '',
            tratamentoProponente: it.tratamentoProponente || 'Vereador',
            partidoProponente: it.partidoProponente || '',
            emailGabinete: it.emailGabinete || '',
            feito: it.motivo || '',
            textoMocao,
            uploadToken: gerarTokenSeguro(20),
          },
        });

        await prisma.mocaoEntregueSapl.upsert({
          where: { saplMateriaId: it.saplMateriaId },
          create: {
            saplMateriaId: it.saplMateriaId,
            numero: it.numero,
            ano: it.ano,
            homenageado: it.homenageado,
            sessaoId: sessao.id,
            devolvidaFila: false,
          },
          update: {
            homenageado: it.homenageado,
            sessaoId: sessao.id,
            devolvidaFila: false,
          },
        });

        importados++;
        if (it.ano) iniciarConsultaFilaSapl(it.ano, true);
      }

      await registrarAuditoria({
        acao: 'IMPORTAR_MOCOES_SAPL',
        entidade: 'Sessao',
        entidadeId: sessaoId,
        detalhes: `${importados} moção(ões) importada(s) do SAPL`,
      });

      return NextResponse.json({ ok: true, importados });
    }

    return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro em POST /api/sapl:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao importar moções.' }, { status: 500 });
  }
}
