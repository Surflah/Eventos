import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  BlocoModelo,
  gerarPdfDePngs,
  montarDicionarioMarcadores,
  OverrideCertificado,
  renderizarArtePng,
} from '@/services/arte.service';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const mRaw = sp.get('m') || 'convite';
    const codigo: 'convite' | 'certificado' | 'convite_geral' =
      mRaw === 'certificado' ? 'certificado' : mRaw === 'convite_geral' ? 'convite_geral' : 'convite';

    const sessaoId = sp.get('s') || '';
    const hid = sp.get('h') || '';
    const lote = sp.get('lote') === '1';
    const formato = sp.get('f') === 'pdf' ? 'pdf' : 'png';
    const baixar = sp.get('baixar') === '1';
    const larguraSaidaPx = sp.get('w') ? Number(sp.get('w')) : undefined;

    const modelo = await prisma.modeloArte.findUnique({ where: { codigo } });
    if (!modelo) {
      return new NextResponse('Modelo não encontrado', { status: 404 });
    }

    const blocos: BlocoModelo[] = JSON.parse(modelo.blocosJson || '[]');
    const nomeFundo = modelo.fundoUrl.replace(/^\/midia\/_fundos\//, '');
    const fundoPath = path.join(process.cwd(), 'storage', 'fundos', nomeFundo);

    const sessao = sessaoId
      ? await prisma.sessao.findUnique({
          where: { id: sessaoId },
          include: { homenageados: { orderBy: { ordem: 'asc' } } },
        })
      : await prisma.sessao.findFirst({
          orderBy: { data: 'desc' },
          include: { homenageados: { orderBy: { ordem: 'asc' } } },
        });

    const dadosSessao = sessao || {
      id: 'amostra',
      titulo: 'Sessão Solene de Homenagens',
      data: new Date().toISOString().slice(0, 10),
      hora: '19:00',
      local: 'Plenário da Câmara Municipal de Itapoá',
      presidente: 'Vereador Márcio José Puglia de Melo (PSD)',
      homenageados: [],
    };

    const sampleHom = {
      id: 'amostra',
      nome: 'Cidadão Homenageado de Exemplo',
      qualificacao: 'Relevantes Serviços à Comunidade',
      comoChamar: 'ao',
      mocao: '41/2026',
      dataAprovacao: '23/11/2026',
      proponente: 'Jéssica Lana Lemonie',
      tratamentoProponente: 'Vereadora',
      partidoProponente: 'PL',
      feito: 'pelos relevantes serviços prestados ao desenvolvimento cultural e comunitário de Itapoá',
      mocaoPdfUrl: 'https://sapl.itapoa.sc.leg.br',
      certificadoOverrideJson: '{}',
    };

    const listaHomenageados =
      dadosSessao.homenageados.length > 0 ? dadosSessao.homenageados : [sampleHom];

    if (lote && formato === 'pdf' && codigo !== 'convite_geral') {
      const pngs: Buffer[] = [];
      for (const hom of listaHomenageados) {
        const dict = montarDicionarioMarcadores({
          sessao: dadosSessao,
          homenageado: hom,
          todosHomenageados: listaHomenageados,
        });
        const override: OverrideCertificado = JSON.parse(hom.certificadoOverrideJson || '{}');
        const png = await renderizarArtePng({
          codigoModelo: codigo,
          larguraPx: modelo.larguraPx,
          alturaPx: modelo.alturaPx,
          fundoPath: fs.existsSync(fundoPath) ? fundoPath : null,
          blocos,
          marcadores: dict,
          overrideCertificado: override,
        });
        pngs.push(png);
      }
      const pdfBuf = await gerarPdfDePngs(pngs, modelo.papel);
      const nomePdf = `${codigo}s-${dadosSessao.id}.pdf`;
      return new NextResponse(new Uint8Array(pdfBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nomePdf}"`,
        },
      });
    }

    const homAlvo =
      (hid ? listaHomenageados.find((x) => x.id === hid) : listaHomenageados[0]) || sampleHom;

    const dict = montarDicionarioMarcadores({
      sessao: dadosSessao,
      homenageado: homAlvo,
      todosHomenageados: listaHomenageados,
    });
    const override: OverrideCertificado = JSON.parse(homAlvo.certificadoOverrideJson || '{}');

    const pngBuf = await renderizarArtePng({
      codigoModelo: codigo,
      larguraPx: modelo.larguraPx,
      alturaPx: modelo.alturaPx,
      fundoPath: fs.existsSync(fundoPath) ? fundoPath : null,
      blocos,
      marcadores: dict,
      overrideCertificado: override,
      larguraSaidaPx: formato === 'png' ? larguraSaidaPx : undefined,
    });

    if (formato === 'pdf') {
      const pdfBuf = await gerarPdfDePngs([pngBuf], modelo.papel);
      const nomePdf = `${codigo}-${homAlvo.id}.pdf`;
      return new NextResponse(new Uint8Array(pdfBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nomePdf}"`,
        },
      });
    }

    const nomePng = `${codigo}-${codigo === 'convite_geral' ? dadosSessao.id : homAlvo.id}.png`;
    return new NextResponse(new Uint8Array(pngBuf), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nomePng}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Erro em GET /api/arte:', err);
    return new NextResponse('Erro ao gerar arte', { status: 500 });
  }
}
