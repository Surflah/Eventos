import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureSqliteWal } from '@/lib/prisma';
import { gerarHid, gerarTokenSeguro } from '@/lib/crypto';
import { calcularHashMesa, VereadorSessaoItem } from '@/core/regimento';
import {
  gerarBlocoCerimonialHomenageado,
  gerarTextoAbertura,
  gerarTextoEncerramento,
} from '@/core/cerimonial';
import { extrairFolderIdDrive, sincronizarPastaDriveSessao } from '@/services/comunicacao.service';
import { sincronizarSessaoNoTabletPresidente } from '@/services/pauta-tablet.service';
import { registrarAuditoria } from '@/lib/auth';

async function carregarSessaoCompleta(id: string) {
  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: { homenageados: { orderBy: { ordem: 'asc' } } },
  });
  if (!sessao) return null;

  const vereadores: VereadorSessaoItem[] = JSON.parse(sessao.vereadoresJson || '[]');
  const checklistManual: Record<string, boolean> = JSON.parse(sessao.checklistJson || '{}');
  const hashAtual = calcularHashMesa(sessao.presidente, vereadores, sessao.autoridades);
  const presencaMudouAposAbertura = Boolean(
    sessao.abertura.trim() && sessao.aberturaMesaHash && sessao.aberturaMesaHash !== hashAtual
  );

  const textosCompletos = Boolean(
    sessao.abertura.trim() &&
      sessao.encerramento.trim() &&
      sessao.homenageados.length > 0 &&
      sessao.homenageados.every((h) => h.textoCerimonial.trim().length > 0)
  );

  const checklist = {
    sapl: sessao.homenageados.length > 0,
    agenda: Boolean(checklistManual.agenda),
    convite_prop: Boolean(checklistManual.convite_prop),
    convite_casa: Boolean(checklistManual.convite_casa),
    textos: textosCompletos,
    midias_ok: Boolean(checklistManual.midias_ok),
    pronunciamentos: Boolean(checklistManual.pronunciamentos),
    certificados: Boolean(checklistManual.certificados),
    tablet: Boolean(checklistManual.tablet || sessao.pautaSessaoId),
    presenca: Boolean(checklistManual.presenca),
    textos_dia: Boolean(checklistManual.textos_dia) && !presencaMudouAposAbertura,
    midias: Boolean(checklistManual.midias),
  };

  const totalContatos = await prisma.contatoCasa.count();

  return {
    ...sessao,
    vereadores,
    checklist,
    presencaMudouAposAbertura,
    totalContatos,
    conviteGeralEnviados: JSON.parse(sessao.conviteGeralEnviadosJson || '[]') as string[],
    homenageados: sessao.homenageados.map((h) => ({
      ...h,
      fotos: JSON.parse(h.fotosJson || '[]') as Array<{
        arquivo: string;
        nomeOriginal: string;
        origem?: string;
      }>,
      certificadoOverride: JSON.parse(h.certificadoOverrideJson || '{}'),
    })),
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSqliteWal();
  const { id } = await context.params;
  const dados = await carregarSessaoCompleta(id);
  if (!dados) {
    return NextResponse.json({ ok: false, error: 'Sessão não encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, sessao: dados });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSqliteWal();
    const { id } = await context.params;
    const body = await req.json();
    const acao = String(body.acao || 'salvar_sessao');

    const atual = await prisma.sessao.findUnique({
      where: { id },
      include: { homenageados: { orderBy: { ordem: 'asc' } } },
    });
    if (!atual) {
      return NextResponse.json({ ok: false, error: 'Sessão não encontrada.' }, { status: 404 });
    }

    if (acao === 'salvar_sessao') {
      const vereadores: VereadorSessaoItem[] = Array.isArray(body.vereadores)
        ? body.vereadores
        : JSON.parse(atual.vereadoresJson || '[]');
      const presidente = body.presidente !== undefined ? String(body.presidente) : atual.presidente;
      const autoridades = body.autoridades !== undefined ? String(body.autoridades) : atual.autoridades;
      const checklistManualAtual = JSON.parse(atual.checklistJson || '{}');
      const novoChecklist = body.checklist
        ? { ...checklistManualAtual, ...body.checklist }
        : checklistManualAtual;

      let abertura = body.abertura !== undefined ? String(body.abertura) : atual.abertura;
      let aberturaMesaHash = atual.aberturaMesaHash;

      if (body.atualizarAberturaComMesa) {
        abertura = gerarTextoAbertura(
          {
            id: atual.id,
            titulo: body.titulo ?? atual.titulo,
            numero: body.numero ?? atual.numero,
            local: body.local ?? atual.local,
            data: body.data ?? atual.data,
            hora: body.hora ?? atual.hora,
            presidente,
            autoridades,
            abertura,
            encerramento: atual.encerramento,
            vereadores,
          },
          atual.homenageados
        );
        aberturaMesaHash = calcularHashMesa(presidente, vereadores, autoridades);
      } else if (body.abertura !== undefined && body.abertura !== atual.abertura) {
        aberturaMesaHash = calcularHashMesa(presidente, vereadores, autoridades);
      }

      const driveUrl = body.driveUrl !== undefined ? String(body.driveUrl) : atual.driveUrl;

      await prisma.sessao.update({
        where: { id },
        data: {
          titulo: body.titulo !== undefined ? String(body.titulo) : atual.titulo,
          numero: body.numero !== undefined ? String(body.numero) : atual.numero,
          local: body.local !== undefined ? String(body.local) : atual.local,
          data: body.data !== undefined ? String(body.data) : atual.data,
          hora: body.hora !== undefined ? String(body.hora) : atual.hora,
          presidente,
          cerimonialista:
            body.cerimonialista !== undefined ? String(body.cerimonialista) : atual.cerimonialista,
          driveUrl,
          driveId: extrairFolderIdDrive(driveUrl),
          vereadoresJson: JSON.stringify(vereadores),
          autoridades,
          abertura,
          aberturaMesaHash,
          encerramento:
            body.encerramento !== undefined ? String(body.encerramento) : atual.encerramento,
          checklistJson: JSON.stringify(novoChecklist),
        },
      });

      const atualizado = await carregarSessaoCompleta(id);
      return NextResponse.json({ ok: true, sessao: atualizado });
    }

    if (acao === 'atualizar_abertura') {
      const vereadores: VereadorSessaoItem[] = JSON.parse(atual.vereadoresJson || '[]');
      const novaAbertura = gerarTextoAbertura(
        {
          ...atual,
          vereadores,
        },
        atual.homenageados
      );
      const hash = calcularHashMesa(atual.presidente, vereadores, atual.autoridades);
      await prisma.sessao.update({
        where: { id },
        data: { abertura: novaAbertura, aberturaMesaHash: hash },
      });
      return NextResponse.json({ ok: true, sessao: await carregarSessaoCompleta(id) });
    }

    if (acao === 'gerar_textos_faltantes' || acao === 'regerar_todos_textos') {
      const forcar = acao === 'regerar_todos_textos';
      const vereadores: VereadorSessaoItem[] = JSON.parse(atual.vereadoresJson || '[]');
      const dadosSessao = { ...atual, vereadores };

      const novaAbertura =
        forcar || !atual.abertura.trim()
          ? gerarTextoAbertura(dadosSessao, atual.homenageados)
          : atual.abertura;
      const novoEncerramento =
        forcar || !atual.encerramento.trim()
          ? gerarTextoEncerramento(dadosSessao, atual.homenageados)
          : atual.encerramento;

      await prisma.sessao.update({
        where: { id },
        data: {
          abertura: novaAbertura,
          aberturaMesaHash: calcularHashMesa(atual.presidente, vereadores, atual.autoridades),
          encerramento: novoEncerramento,
        },
      });

      for (let i = 0; i < atual.homenageados.length; i++) {
        const h = atual.homenageados[i];
        if (forcar || !h.textoCerimonial.trim()) {
          await prisma.homenageado.update({
            where: { id: h.id },
            data: { textoCerimonial: gerarBlocoCerimonialHomenageado(h, i + 5) },
          });
        }
      }

      await registrarAuditoria({
        acao: forcar ? 'REGERAR_TEXTOS_CERIMONIAL' : 'GERAR_TEXTOS_FALTANTES',
        entidade: 'Sessao',
        entidadeId: id,
      });
      return NextResponse.json({ ok: true, sessao: await carregarSessaoCompleta(id) });
    }

    if (acao === 'adicionar_homenageado') {
      const nome = String(body.nome || '').trim();
      if (!nome) {
        return NextResponse.json({ ok: false, error: 'Informe o nome do homenageado.' }, { status: 400 });
      }
      const maxOrdem = atual.homenageados.reduce((m, h) => Math.max(m, h.ordem), 0);
      const hid = gerarHid();
      await prisma.homenageado.create({
        data: {
          id: hid,
          sessaoId: id,
          ordem: maxOrdem + 1,
          nome,
          comoChamar: 'ao',
          uploadToken: gerarTokenSeguro(20),
        },
      });
      await registrarAuditoria({
        acao: 'ADICIONAR_HOMENAGEADO_MANUAL',
        entidade: 'Homenageado',
        entidadeId: hid,
        detalhes: `${nome} na sessão ${id}`,
      });
      return NextResponse.json({ ok: true, hid, sessao: await carregarSessaoCompleta(id) });
    }

    if (acao === 'salvar_homenageado') {
      const hid = String(body.hid || '');
      const hAtual = atual.homenageados.find((h) => h.id === hid);
      if (!hAtual) {
        return NextResponse.json({ ok: false, error: 'Homenageado não encontrado.' }, { status: 404 });
      }

      await prisma.homenageado.update({
        where: { id: hid },
        data: {
          nome: body.nome !== undefined ? String(body.nome) : hAtual.nome,
          qualificacao:
            body.qualificacao !== undefined ? String(body.qualificacao) : hAtual.qualificacao,
          comoChamar: body.comoChamar !== undefined ? String(body.comoChamar) : hAtual.comoChamar,
          mocao: body.mocao !== undefined ? String(body.mocao) : hAtual.mocao,
          dataAprovacao:
            body.dataAprovacao !== undefined ? String(body.dataAprovacao) : hAtual.dataAprovacao,
          proponente: body.proponente !== undefined ? String(body.proponente) : hAtual.proponente,
          tratamentoProponente:
            body.tratamentoProponente !== undefined
              ? String(body.tratamentoProponente)
              : hAtual.tratamentoProponente,
          partidoProponente:
            body.partidoProponente !== undefined
              ? String(body.partidoProponente)
              : hAtual.partidoProponente,
          emailGabinete:
            body.emailGabinete !== undefined ? String(body.emailGabinete) : hAtual.emailGabinete,
          obs: body.obs !== undefined ? String(body.obs) : hAtual.obs,
          feito: body.feito !== undefined ? String(body.feito) : hAtual.feito,
          textoCerimonial:
            body.textoCerimonial !== undefined
              ? String(body.textoCerimonial)
              : hAtual.textoCerimonial,
          textoMocao: body.textoMocao !== undefined ? String(body.textoMocao) : hAtual.textoMocao,
          modoVideo: body.modoVideo !== undefined ? String(body.modoVideo) : hAtual.modoVideo,
          vaiFalar: body.vaiFalar !== undefined ? String(body.vaiFalar) : hAtual.vaiFalar,
          representanteNome:
            body.representanteNome !== undefined
              ? String(body.representanteNome)
              : hAtual.representanteNome,
          representanteCargo:
            body.representanteCargo !== undefined
              ? String(body.representanteCargo)
              : hAtual.representanteCargo,
          certificadoOverrideJson:
            body.certificadoOverride !== undefined
              ? JSON.stringify(body.certificadoOverride)
              : hAtual.certificadoOverrideJson,
          prazoReabertoAte:
            body.prazoReabertoAte !== undefined
              ? body.prazoReabertoAte
                ? new Date(body.prazoReabertoAte)
                : null
              : hAtual.prazoReabertoAte,
        },
      });

      return NextResponse.json({ ok: true, sessao: await carregarSessaoCompleta(id) });
    }

    if (acao === 'reordenar_homenageado') {
      const hid = String(body.hid || '');
      const direcao = body.direcao === 'up' ? -1 : 1;
      const lista = [...atual.homenageados];
      const idx = lista.findIndex((h) => h.id === hid);
      const alvo = idx + direcao;
      if (idx >= 0 && alvo >= 0 && alvo < lista.length) {
        const temp = lista[idx];
        lista[idx] = lista[alvo];
        lista[alvo] = temp;
        for (let i = 0; i < lista.length; i++) {
          await prisma.homenageado.update({
            where: { id: lista[i].id },
            data: { ordem: i + 1 },
          });
        }
      }
      return NextResponse.json({ ok: true, sessao: await carregarSessaoCompleta(id) });
    }

    if (acao === 'remover_homenageado') {
      const hid = String(body.hid || '');
      const alvo = atual.homenageados.find((h) => h.id === hid);
      if (alvo) {
        await prisma.homenageado.delete({ where: { id: hid } });
        if (alvo.saplMateriaId) {
          await prisma.mocaoEntregueSapl.updateMany({
            where: { saplMateriaId: alvo.saplMateriaId },
            data: { devolvidaFila: true, sessaoId: null },
          });
        }
        await registrarAuditoria({
          acao: 'REMOVER_HOMENAGEADO',
          entidade: 'Homenageado',
          entidadeId: hid,
          detalhes: alvo.nome,
        });
      }
      return NextResponse.json({ ok: true, sessao: await carregarSessaoCompleta(id) });
    }

    if (acao === 'remover_midia') {
      const hid = String(body.hid || '');
      const hAtual = atual.homenageados.find((h) => h.id === hid);
      if (!hAtual) return NextResponse.json({ ok: false }, { status: 404 });

      if (body.tipo === 'video') {
        if (hAtual.videoArquivo) {
          const rel = hAtual.videoArquivo.replace(/^\/midia\//, '');
          const fp = path.join(process.cwd(), 'storage', 'midia', rel);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        await prisma.homenageado.update({
          where: { id: hid },
          data: { videoArquivo: null },
        });
      } else if (body.arquivo) {
        const fotos = JSON.parse(hAtual.fotosJson || '[]') as Array<{ arquivo: string }>;
        const novas = fotos.filter((f) => f.arquivo !== body.arquivo);
        const rel = String(body.arquivo).replace(/^\/midia\//, '');
        const fp = path.join(process.cwd(), 'storage', 'midia', rel);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
        await prisma.homenageado.update({
          where: { id: hid },
          data: { fotosJson: JSON.stringify(novas) },
        });
      }
      return NextResponse.json({ ok: true, sessao: await carregarSessaoCompleta(id) });
    }

    if (acao === 'varrer_videos_disco') {
      let encontrados = 0;
      for (const h of atual.homenageados) {
        const dirVid = path.join(process.cwd(), 'storage', 'midia', id, h.id, 'video');
        if (fs.existsSync(dirVid)) {
          const arqs = fs
            .readdirSync(dirVid)
            .filter((f) => /\.(mp4|webm|mov|m4v)$/i.test(f));
          if (arqs.length > 0) {
            const rel = `/midia/${id}/${h.id}/video/${arqs[0]}`;
            if (h.videoArquivo !== rel) {
              await prisma.homenageado.update({
                where: { id: h.id },
                data: { videoArquivo: rel },
              });
              encontrados++;
            }
          }
        }
      }
      return NextResponse.json({
        ok: true,
        encontrados,
        sessao: await carregarSessaoCompleta(id),
      });
    }

    if (acao === 'sincronizar_drive') {
      const resDrive = await sincronizarPastaDriveSessao(id);
      return NextResponse.json({
        ...resDrive,
        sessao: await carregarSessaoCompleta(id),
      });
    }

    if (acao === 'sincronizar_tablet') {
      const resTab = await sincronizarSessaoNoTabletPresidente(id);
      if (resTab.ok) {
        const ck = JSON.parse(atual.checklistJson || '{}');
        ck.tablet = true;
        await prisma.sessao.update({
          where: { id },
          data: { checklistJson: JSON.stringify(ck) },
        });
      }
      return NextResponse.json({
        ...resTab,
        sessao: await carregarSessaoCompleta(id),
      });
    }

    if (acao === 'arquivar_sessao') {
      const arquivar = Boolean(body.arquivada ?? true);
      await prisma.sessao.update({
        where: { id },
        data: { arquivada: arquivar },
      });
      await registrarAuditoria({
        acao: arquivar ? 'ARQUIVAR_SESSAO' : 'DESARQUIVAR_SESSAO',
        entidade: 'Sessao',
        entidadeId: id,
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'excluir_sessao') {
      await prisma.sessao.delete({ where: { id } });
      const dirMidia = path.join(process.cwd(), 'storage', 'midia', id);
      if (fs.existsSync(dirMidia)) {
        fs.rmSync(dirMidia, { recursive: true, force: true });
      }
      await registrarAuditoria({
        acao: 'EXCLUIR_SESSAO',
        entidade: 'Sessao',
        entidadeId: id,
        detalhes: atual.titulo,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Ação desconhecida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro em POST /api/sessoes/[id]:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao atualizar sessão.' }, { status: 500 });
  }
}
