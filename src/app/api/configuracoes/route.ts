import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { criptografarTexto, hashSenha, verificarSenha } from '@/lib/crypto';
import { obterUsuarioAtual, registrarAuditoria } from '@/lib/auth';
import { enviarEmailInstitucional } from '@/services/comunicacao.service';

export async function GET() {
  const [configs, vereadores, trilhas, usuarios] = await Promise.all([
    prisma.configuracao.findMany(),
    prisma.vereador.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] }),
    prisma.trilhaAudio.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.usuarioPainel.findMany({ orderBy: { email: 'asc' } }),
  ]);

  const map = Object.fromEntries(configs.map((c) => [c.chave, c.valor]));

  return NextResponse.json({
    ok: true,
    config: {
      googleApiKeyConfigurada: Boolean(map.google_api_key),
      googleOauthClientId: map.google_oauth_client_id || process.env.GOOGLE_CLIENT_ID || '',
      googleOauthSecretConfigurado: Boolean(
        map.google_oauth_client_secret_enc || process.env.GOOGLE_CLIENT_SECRET
      ),
      googleCasaEmail: map.google_casa_email || 'eventos@camaraitapoa.sc.gov.br',
      googleCasaConectada: Boolean(map.google_casa_refresh_token_enc),
      googleCasaAutorizadoEm: map.google_casa_autorizado_em || '',
      remetenteNome: map.remetente_nome || 'Setor de Eventos - Câmara de Itapoá',
      responderPara: map.responder_para || '',
      copiaPara: map.copia_para || '',
      envioHoraInicio: Number(map.envio_hora_inicio ?? 8),
      envioHoraFim: Number(map.envio_hora_fim ?? 19),
      horaLembretes: Number(map.hora_lembretes ?? 9),
      dominiosLogin: map.dominios_login || 'camaraitapoa.sc.gov.br',
    },
    vereadores,
    trilhas,
    usuarios: usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      nome: u.nome,
      podeEnviarEmail: u.podeEnviarEmail,
      ultimoAcesso: u.ultimoAcesso,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';

    // Upload de trilha MP3/WAV
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const arq = form.get('trilha') as File | null;
      if (!arq || !arq.name) {
        return NextResponse.json({ ok: false, error: 'Selecione um arquivo de áudio.' }, { status: 400 });
      }
      const buf = Buffer.from(await arq.arrayBuffer());
      const safeName = arq.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const dir = path.join(process.cwd(), 'storage', 'trilhas');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, safeName), buf);

      await prisma.trilhaAudio.upsert({
        where: { arquivo: safeName },
        create: { nome: arq.name, arquivo: safeName, tamanho: buf.length },
        update: { nome: arq.name, tamanho: buf.length },
      });

      await registrarAuditoria({
        acao: 'UPLOAD_TRILHA_AUDIO',
        entidade: 'TrilhaAudio',
        detalhes: safeName,
      });

      return NextResponse.json({ ok: true });
    }

    const body = await req.json();
    const acao = String(body.acao || '');

    const salvarChave = async (chave: string, valor: string) =>
      prisma.configuracao.upsert({
        where: { chave },
        create: { chave, valor },
        update: { valor },
      });

    if (acao === 'salvar_drive_key') {
      const key = String(body.googleApiKey || '').trim();
      if (key) {
        await salvarChave('google_api_key', criptografarTexto(key));
      }
      await registrarAuditoria({ acao: 'SALVAR_GOOGLE_DRIVE_KEY', entidade: 'Configuracao' });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'salvar_oauth_credenciais') {
      const cid = String(body.clientId || '').trim();
      const csec = String(body.clientSecret || '').trim();
      await salvarChave('google_oauth_client_id', cid);
      if (csec) {
        await salvarChave('google_oauth_client_secret_enc', criptografarTexto(csec));
      }
      await registrarAuditoria({ acao: 'SALVAR_GOOGLE_OAUTH_CREDENCIAIS', entidade: 'Configuracao' });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'remover_trilha') {
      const arquivo = String(body.arquivo || '');
      await prisma.trilhaAudio.deleteMany({ where: { arquivo } });
      const fp = path.join(process.cwd(), 'storage', 'trilhas', path.basename(arquivo));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      await registrarAuditoria({ acao: 'REMOVER_TRILHA', entidade: 'TrilhaAudio', detalhes: arquivo });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'salvar_composicao') {
      const lista: Array<{
        nome: string;
        tratamento: string;
        partido: string;
        cargo: string;
        ordem: number;
        email: string;
        whatsapp: string;
        ativo: boolean;
      }> = Array.isArray(body.vereadores) ? body.vereadores : [];

      const validos = lista.filter((v) => v.nome?.trim());

      await prisma.$transaction([
        prisma.vereador.deleteMany({}),
        prisma.vereador.createMany({
          data: validos.map((v) => ({
            nome: v.nome.trim(),
            tratamento: v.tratamento === 'Vereadora' ? 'Vereadora' : 'Vereador',
            partido: (v.partido || '').trim(),
            cargo: (v.cargo || '').trim(),
            ordem: Number(v.ordem) || 10,
            email: (v.email || '').trim().toLowerCase(),
            whatsapp: (v.whatsapp || '').trim(),
            ativo: Boolean(v.ativo),
          })),
        }),
      ]);

      await registrarAuditoria({
        acao: 'SALVAR_COMPOSICAO_CASA',
        entidade: 'Vereador',
        detalhes: `${validos.length} vereador(es)`,
      });

      return NextResponse.json({ ok: true });
    }

    if (acao === 'salvar_dados_envio') {
      await Promise.all([
        salvarChave('remetente_nome', String(body.remetenteNome || '').trim()),
        salvarChave('responder_para', String(body.responderPara || '').trim()),
        salvarChave('copia_para', String(body.copiaPara || '').trim()),
        salvarChave('envio_hora_inicio', String(Number(body.envioHoraInicio ?? 8))),
        salvarChave('envio_hora_fim', String(Number(body.envioHoraFim ?? 19))),
        salvarChave('hora_lembretes', String(Number(body.horaLembretes ?? 9))),
      ]);
      await registrarAuditoria({ acao: 'SALVAR_DADOS_ENVIO', entidade: 'Configuracao' });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'enviar_teste') {
      const destino = String(body.destino || '').trim();
      const user = await obterUsuarioAtual();
      const r = await enviarEmailInstitucional({
        para: [destino],
        assunto: 'Teste de envio · Sessão Solene de Homenagens (Câmara de Itapoá)',
        html: `<p>Este é um e-mail de teste disparado pelo sistema <strong>Eventos / Sessão Solene de Homenagens</strong> da Câmara Municipal de Itapoá.</p>`,
        usuarioLogado: user,
      });
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: r.erro });
      }
      return NextResponse.json({ ok: true, remetenteUsado: r.remetenteUsado });
    }

    if (acao === 'desconectar_google_casa') {
      await prisma.configuracao.deleteMany({
        where: { chave: { in: ['google_casa_refresh_token_enc', 'google_casa_autorizado_em'] } },
      });
      await registrarAuditoria({ acao: 'DESCONECTAR_GOOGLE_CASA', entidade: 'Configuracao' });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'salvar_dominios') {
      await salvarChave('dominios_login', String(body.dominiosLogin || 'camaraitapoa.sc.gov.br').trim());
      await registrarAuditoria({ acao: 'SALVAR_DOMINIOS_LOGIN', entidade: 'Configuracao' });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'remover_usuario') {
      const email = String(body.email || '');
      await prisma.usuarioPainel.deleteMany({ where: { email } });
      await registrarAuditoria({ acao: 'REMOVER_USUARIO_PAINEL', entidade: 'UsuarioPainel', detalhes: email });
      return NextResponse.json({ ok: true });
    }

    if (acao === 'trocar_senha') {
      const atual = String(body.atual || '');
      const nova = String(body.nova || '');
      if (nova.length < 8) {
        return NextResponse.json(
          { ok: false, error: 'A nova senha deve ter no mínimo 8 caracteres.' },
          { status: 400 }
        );
      }
      const cfg = await prisma.configuracao.findUnique({ where: { chave: 'senha_painel_hash' } });
      if (cfg && !verificarSenha(atual, cfg.valor)) {
        return NextResponse.json({ ok: false, error: 'A senha atual informada está incorreta.' }, { status: 400 });
      }
      await salvarChave('senha_painel_hash', hashSenha(nova));
      await registrarAuditoria({ acao: 'TROCAR_SENHA_PAINEL', entidade: 'Configuracao' });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Ação desconhecida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro em POST /api/configuracoes:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao salvar configuração.' }, { status: 500 });
  }
}
