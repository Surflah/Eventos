import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { obterUsuarioAtual, registrarAuditoria } from '@/lib/auth';
import { enviarEmailInstitucional } from '@/services/comunicacao.service';
import {
  BlocoModelo,
  montarDicionarioMarcadores,
  renderizarArtePng,
} from '@/services/arte.service';
import { calcularStatusPrazoMidia, formatarDataCurta, formatarDataExtenso } from '@/core/regimento';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const acao = String(body.acao || '');
    const user = await obterUsuarioAtual();
    const appUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, '');

    if (acao === 'convite_proponente') {
      const sessaoId = String(body.sessaoId || '');
      const hid = String(body.hid || '');
      const paraRaw = String(body.enviarPara || '');
      const destinatarios = paraRaw
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      if (destinatarios.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Informe ao menos um e-mail destinatário do gabinete.' },
          { status: 400 }
        );
      }

      const sessao = await prisma.sessao.findUnique({
        where: { id: sessaoId },
        include: { homenageados: { orderBy: { ordem: 'asc' } } },
      });
      const hom = sessao?.homenageados.find((h) => h.id === hid);
      if (!sessao || !hom) {
        return NextResponse.json({ ok: false, error: 'Homenageado não encontrado.' }, { status: 404 });
      }

      // Renderiza o Convite individual PNG em anexo (o certificado NÃO vai neste e-mail)
      const modeloConv = await prisma.modeloArte.findUnique({ where: { codigo: 'convite' } });
      const blocos: BlocoModelo[] = modeloConv ? JSON.parse(modeloConv.blocosJson || '[]') : [];
      const nomeFundo = (modeloConv?.fundoUrl || '').replace(/^\/midia\/_fundos\//, '');
      const fundoPath = path.join(process.cwd(), 'storage', 'fundos', nomeFundo);

      const dict = montarDicionarioMarcadores({
        sessao,
        homenageado: hom,
        todosHomenageados: sessao.homenageados,
      });

      const convitePng = await renderizarArtePng({
        codigoModelo: 'convite',
        larguraPx: modeloConv?.larguraPx || 1748,
        alturaPx: modeloConv?.alturaPx || 1240,
        fundoPath: fs.existsSync(fundoPath) ? fundoPath : null,
        blocos,
        marcadores: dict,
      });

      const linkUpload = `${appUrl}/enviar/${hom.uploadToken}`;
      const prazo = calcularStatusPrazoMidia(sessao.data, hom.prazoReabertoAte);

      const html = `
        <div style="font-family: Arial, sans-serif; color: #151a22; max-width: 640px; line-height: 1.6;">
          <h2 style="color: #123f6b; margin-bottom: 8px;">Sessão Solene de Homenagens — ${formatarDataCurta(sessao.data)}</h2>
          <p>Prezado(a) Gabinete (${hom.tratamentoProponente} <strong>${hom.proponente}</strong>),</p>
          <p>
            Segue em anexo o <strong>Convite Oficial</strong> referente à
            <strong>Moção nº ${hom.mocao || '—'}</strong> em homenagem ${hom.comoChamar} <strong>${hom.nome}</strong>,
            que será entregue em <strong>${formatarDataExtenso(sessao.data, true)} às ${sessao.hora}</strong>,
            no ${sessao.local}.
          </p>
          <p>
            Utilize ou encaminhe ao homenageado o link exclusivo abaixo para envio das <strong>fotos (10 a 20 fotos)</strong>,
            eventual <strong>vídeo</strong> e confirmação de quem usará a palavra em plenário:
          </p>
          <p style="margin: 20px 0;">
            <a href="${linkUpload}" style="background:#1f5fe0;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
              Enviar fotos e vídeo da homenagem
            </a>
          </p>
          <p style="font-size: 13px; color: #5f6b7e; word-break: break-all;">
            Link direto: <a href="${linkUpload}">${linkUpload}</a><br/>
            Prazo limite para envio das mídias: <strong>${prazo.ddMmVespera} (véspera da sessão) às 23h59</strong>.
          </p>
          <hr style="border:none;border-top:1px solid #dde3ec;margin:20px 0;" />
          <p style="font-size:12px;color:#5f6b7e;">Setor de Eventos · Câmara Municipal de Itapoá</p>
        </div>
      `;

      const envio = await enviarEmailInstitucional({
        para: destinatarios,
        assunto: `Convite e Link de Mídias — Moção ${hom.mocao || ''} (${hom.nome}) · Sessão Solene ${formatarDataCurta(sessao.data)}`,
        html,
        anexos: [
          {
            filename: `convite-${hom.id}.png`,
            content: convitePng,
            contentType: 'image/png',
          },
        ],
        usuarioLogado: user,
      });

      if (!envio.ok) {
        return NextResponse.json({
          ok: false,
          error: envio.erro,
          linkUpload,
        });
      }

      await prisma.homenageado.update({
        where: { id: hom.id },
        data: {
          emailGabinete: paraRaw,
          convitePropEnviadoEm: new Date(),
        },
      });

      await registrarAuditoria({
        acao: 'ENVIAR_CONVITE_PROPONENTE',
        entidade: 'Homenageado',
        entidadeId: hom.id,
        detalhes: `Para: ${destinatarios.join(', ')} via ${envio.remetenteUsado}`,
      });

      return NextResponse.json({
        ok: true,
        remetenteUsado: envio.remetenteUsado,
        linkUpload,
      });
    }

    if (acao === 'convite_geral') {
      const sessaoId = String(body.sessaoId || '');
      const usarBcc = Boolean(body.usarBcc ?? true);
      const lembrete = Boolean(body.lembrete ?? false);
      const emails: string[] = Array.isArray(body.emails)
        ? body.emails.map((e: string) => String(e).trim()).filter(Boolean)
        : [];

      if (emails.length === 0) {
        return NextResponse.json({ ok: false, error: 'Marque ao menos um contato.' }, { status: 400 });
      }

      const sessao = await prisma.sessao.findUnique({
        where: { id: sessaoId },
        include: { homenageados: { orderBy: { ordem: 'asc' } } },
      });
      if (!sessao) {
        return NextResponse.json({ ok: false, error: 'Sessão não encontrada.' }, { status: 404 });
      }

      const modeloGeral = await prisma.modeloArte.findUnique({ where: { codigo: 'convite_geral' } });
      const blocos: BlocoModelo[] = modeloGeral ? JSON.parse(modeloGeral.blocosJson || '[]') : [];
      const nomeFundo = (modeloGeral?.fundoUrl || '').replace(/^\/midia\/_fundos\//, '');
      const fundoPath = path.join(process.cwd(), 'storage', 'fundos', nomeFundo);

      const dict = montarDicionarioMarcadores({
        sessao,
        todosHomenageados: sessao.homenageados,
      });

      const artePng = await renderizarArtePng({
        codigoModelo: 'convite_geral',
        larguraPx: modeloGeral?.larguraPx || 1748,
        alturaPx: modeloGeral?.alturaPx || 1240,
        fundoPath: fs.existsSync(fundoPath) ? fundoPath : null,
        blocos,
        marcadores: dict,
      });

      const listaHtml = sessao.homenageados
        .map((h) => `<li><strong>${h.nome}</strong>${h.mocao ? ` (Moção nº ${h.mocao} — ${h.proponente})` : ''}</li>`)
        .join('');

      const html = `
        <div style="font-family: Arial, sans-serif; color: #151a22; max-width: 640px; line-height: 1.6;">
          <h2 style="color: #123f6b;">Convite — ${sessao.titulo} (${formatarDataCurta(sessao.data)})</h2>
          <p>A Câmara Municipal de Itapoá tem a honra de convidá-lo(a) para a <strong>${sessao.titulo}</strong>, que será realizada em <strong>${formatarDataExtenso(sessao.data, true)} às ${sessao.hora}</strong>, no ${sessao.local}.</p>
          ${listaHtml ? `<p>Homenageados desta edição:</p><ul>${listaHtml}</ul>` : ''}
          <p>O convite ilustrado segue em anexo.</p>
          <hr style="border:none;border-top:1px solid #dde3ec;margin:20px 0;" />
          <p style="font-size:12px;color:#5f6b7e;">Câmara Municipal de Itapoá · Poder Legislativo</p>
        </div>
      `;

      const prefixo = lembrete ? 'LEMBRETE: ' : '';
      const envio = await enviarEmailInstitucional({
        para: usarBcc ? [] : emails,
        bcc: usarBcc ? emails : [],
        assunto: `${prefixo}Convite — ${sessao.titulo} (${formatarDataCurta(sessao.data)} às ${sessao.hora})`,
        html,
        anexos: [
          {
            filename: `convite-sessao-solene-${sessao.data}.png`,
            content: artePng,
            contentType: 'image/png',
          },
        ],
        usuarioLogado: user,
      });

      if (!envio.ok) {
        return NextResponse.json({ ok: false, error: envio.erro });
      }

      const jaEnviados = new Set<string>(JSON.parse(sessao.conviteGeralEnviadosJson || '[]'));
      emails.forEach((e) => jaEnviados.add(e.toLowerCase()));
      const ck = JSON.parse(sessao.checklistJson || '{}');
      ck.convite_casa = true;

      await prisma.sessao.update({
        where: { id: sessao.id },
        data: {
          conviteGeralEnviadosJson: JSON.stringify(Array.from(jaEnviados)),
          checklistJson: JSON.stringify(ck),
        },
      });

      await registrarAuditoria({
        acao: 'ENVIAR_CONVITE_GERAL',
        entidade: 'Sessao',
        entidadeId: sessao.id,
        detalhes: `${emails.length} destinatário(s), BCC=${usarBcc}`,
      });

      return NextResponse.json({
        ok: true,
        totalReceberam: jaEnviados.size,
        remetenteUsado: envio.remetenteUsado,
      });
    }

    return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro em POST /api/comunicacoes:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao disparar comunicação.' }, { status: 500 });
  }
}
