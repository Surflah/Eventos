import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { formatarDataCurta } from '@/core/regimento';
import {
  DadosHomenageadoCerimonial,
  DadosSessaoCerimonial,
  gerarItensTabletPresidente,
} from '@/core/cerimonial';
import { registrarAuditoria } from '@/lib/auth';

export async function sincronizarSessaoNoTabletPresidente(sessaoId: string): Promise<{
  ok: boolean;
  pautaSessaoId?: number;
  criados: number;
  atualizados: number;
  urlPainelPauta: string;
  mensagem: string;
}> {
  const urlPainelPauta = process.env.PAUTA_ONLINE_URL || 'https://pauta.camaraitapoa.sc.gov.br';
  const dbPath = process.env.PAUTA_DB_PATH || '/var/www/pauta/prisma/pauta.db';

  const sessao = await prisma.sessao.findUnique({
    where: { id: sessaoId },
    include: { homenageados: { orderBy: { ordem: 'asc' } } },
  });

  if (!sessao) {
    return { ok: false, criados: 0, atualizados: 0, urlPainelPauta, mensagem: 'Sessão não encontrada.' };
  }

  const dadosSessao: DadosSessaoCerimonial = {
    id: sessao.id,
    titulo: sessao.titulo,
    numero: sessao.numero,
    local: sessao.local,
    data: sessao.data,
    hora: sessao.hora,
    presidente: sessao.presidente,
    autoridades: sessao.autoridades,
    abertura: sessao.abertura,
    encerramento: sessao.encerramento,
    vereadores: JSON.parse(sessao.vereadoresJson || '[]'),
  };

  const dadosHomenageados: DadosHomenageadoCerimonial[] = sessao.homenageados;
  const itens = gerarItensTabletPresidente(dadosSessao, dadosHomenageados);
  const nomeSessaoPauta = `Sessão Solene Mensal de Homenagens - ${formatarDataCurta(sessao.data)}`;

  if (!fs.existsSync(dbPath)) {
    return {
      ok: false,
      criados: 0,
      atualizados: 0,
      urlPainelPauta,
      mensagem: `Banco do PautaOnline não localizado em ${dbPath}. Os 3 textos estão prontos na tela para cópia rápida.`,
    };
  }

  try {
    // Usa o módulo nativo node:sqlite do Node 22+ para operação transacional idempotente no PautaOnline
    const sqlite = await import('node:sqlite');
    const db = new sqlite.DatabaseSync(dbPath);

    try {
      db.exec('PRAGMA busy_timeout = 5000;');
      const agoraIso = new Date().toISOString();

      const existente = db
        .prepare('SELECT id FROM Sessao WHERE nome = ? LIMIT 1')
        .get(nomeSessaoPauta) as { id: number } | undefined;

      let pautaSessaoId: number;
      if (existente?.id) {
        pautaSessaoId = Number(existente.id);
        db.prepare('UPDATE Sessao SET pautaUpdatedAt = ?, updatedAt = ? WHERE id = ?').run(
          agoraIso,
          agoraIso,
          pautaSessaoId
        );
      } else {
        const ins = db
          .prepare(
            `INSERT INTO Sessao (nome, tipo, dataSessao, status, pautaUpdatedAt, createdAt, updatedAt)
             VALUES (?, 'Solene', ?, 'EM_ANDAMENTO', ?, ?, ?)`
          )
          .run(nomeSessaoPauta, `${sessao.data}T${sessao.hora || '19:00'}:00.000Z`, agoraIso, agoraIso, agoraIso);
        pautaSessaoId = Number(ins.lastInsertRowid);
      }

      let criados = 0;
      let atualizados = 0;

      for (const item of itens) {
        const itemExistente = db
          .prepare('SELECT id FROM PautaItem WHERE sessaoId = ? AND titulo = ? LIMIT 1')
          .get(pautaSessaoId, item.titulo) as { id: number } | undefined;

        if (itemExistente?.id) {
          db.prepare('UPDATE PautaItem SET ementa = ?, numero = ?, updatedAt = ? WHERE id = ?').run(
            item.ementa,
            item.numero,
            agoraIso,
            itemExistente.id
          );
          atualizados++;
        } else {
          db.prepare(
            `INSERT INTO PautaItem
             (sessaoId, numero, titulo, ementa, tipoItem, autor, votacaoEtapa, votavel, jaRevisado, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 'Rito Solene', 'Mesa Diretora', 'Não Votável', 0, 1, ?, ?)`
          ).run(pautaSessaoId, item.numero, item.titulo, item.ementa, agoraIso, agoraIso);
          criados++;
        }
      }

      await prisma.sessao.update({
        where: { id: sessao.id },
        data: { pautaSessaoId },
      });

      await registrarAuditoria({
        acao: 'SINCRONIZAR_TABLET_PRESIDENTE',
        entidade: 'Sessao',
        entidadeId: sessao.id,
        detalhes: `Sincronizado no PautaOnline (#${pautaSessaoId}): ${criados} criado(s), ${atualizados} atualizado(s)`,
      });

      return {
        ok: true,
        pautaSessaoId,
        criados,
        atualizados,
        urlPainelPauta: `${urlPainelPauta}/sessoes/${pautaSessaoId}/tablet-presidente`,
        mensagem: `Sincronizado com sucesso no PautaOnline (${criados} item(ns) novo(s), ${atualizados} atualizado(s)).`,
      };
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('Erro ao sincronizar com PautaOnline:', err);
    return {
      ok: false,
      criados: 0,
      atualizados: 0,
      urlPainelPauta,
      mensagem: err instanceof Error ? err.message : 'Erro ao gravar no banco do PautaOnline.',
    };
  }
}
