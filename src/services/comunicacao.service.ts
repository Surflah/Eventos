import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { descriptografarTexto } from '@/lib/crypto';
import { SessaoUsuario, registrarAuditoria } from '@/lib/auth';

export interface AnexoEmail {
  filename: string;
  content: Buffer;
  contentType: string;
}

async function obterAccessTokenGoogle(refreshTokenCifrado: string): Promise<string | null> {
  const refreshToken = descriptografarTexto(refreshTokenCifrado);
  if (!refreshToken) return null;

  const [cfgId, cfgSec] = await Promise.all([
    prisma.configuracao.findUnique({ where: { chave: 'google_oauth_client_id' } }),
    prisma.configuracao.findUnique({ where: { chave: 'google_oauth_client_secret_enc' } }),
  ]);

  const clientId = cfgId?.valor || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = descriptografarTexto(cfgSec?.valor) || process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

function construirRawMimeRfc2822(params: {
  from: string;
  to: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: AnexoEmail[];
}): string {
  const boundary = `ssmh_bound_${Date.now().toString(16)}`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject, 'utf8').toString('base64')}?=`;

  const headers = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    ...(params.bcc ? [`Bcc: ${params.bcc}`] : []),
    ...(params.replyTo ? [`Reply-To: ${params.replyTo}`] : []),
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts: string[] = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(params.html, 'utf8').toString('base64'),
  ];

  for (const att of params.attachments || []) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      att.content.toString('base64')
    );
  }

  parts.push(`--${boundary}--`, '');
  const full = [...headers, '', ...parts].join('\r\n');
  return Buffer.from(full, 'utf8').toString('base64url');
}

export async function enviarEmailInstitucional(params: {
  para: string[];
  bcc?: string[];
  assunto: string;
  html: string;
  anexos?: AnexoEmail[];
  usuarioLogado?: SessaoUsuario | null;
}): Promise<{ ok: boolean; remetenteUsado: string; modo: string; erro?: string }> {
  const configs = await prisma.configuracao.findMany();
  const cfgMap = Object.fromEntries(configs.map((c) => [c.chave, c.valor]));

  const remetenteNome = cfgMap.remetente_nome || 'Setor de Eventos - Câmara de Itapoá';
  const responderPara = cfgMap.responder_para || '';
  const copiaAuditoria = (cfgMap.copia_para || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const bccFinal = Array.from(new Set([...(params.bcc || []), ...copiaAuditoria]));

  // 1. Tenta OAuth do próprio servidor logado (quando entrou pelo Google)
  let accessToken: string | null = null;
  let emailRemetente = cfgMap.google_casa_email || 'eventos@camaraitapoa.sc.gov.br';

  if (params.usuarioLogado?.metodo === 'google' && params.usuarioLogado.email) {
    const u = await prisma.usuarioPainel.findUnique({ where: { email: params.usuarioLogado.email } });
    if (u?.refreshTokenEnc) {
      accessToken = await obterAccessTokenGoogle(u.refreshTokenEnc);
      if (accessToken) emailRemetente = u.email;
    }
  }

  // 2. Fallback para Conta Google da Casa
  if (!accessToken && cfgMap.google_casa_refresh_token_enc) {
    accessToken = await obterAccessTokenGoogle(cfgMap.google_casa_refresh_token_enc);
    emailRemetente = cfgMap.google_casa_email || 'eventos@camaraitapoa.sc.gov.br';
  }

  if (accessToken) {
    const raw = construirRawMimeRfc2822({
      from: `"${remetenteNome}" <${emailRemetente}>`,
      to: params.para.length > 0 ? params.para.join(', ') : emailRemetente,
      bcc: bccFinal.length > 0 ? bccFinal.join(', ') : undefined,
      replyTo: params.usuarioLogado?.email || responderPara || undefined,
      subject: params.assunto,
      html: params.html,
      attachments: params.anexos,
    });

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      return { ok: false, remetenteUsado: emailRemetente, modo: 'gmail_oauth', erro: errTxt.slice(0, 300) };
    }
    return { ok: true, remetenteUsado: emailRemetente, modo: 'gmail_oauth' };
  }

  // 3. Fallback SMTP se configurado em variáveis de ambiente
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${remetenteNome}" <${process.env.SMTP_USER}>`,
      to: params.para.length > 0 ? params.para.join(', ') : process.env.SMTP_USER,
      bcc: bccFinal.length > 0 ? bccFinal.join(', ') : undefined,
      replyTo: responderPara || undefined,
      subject: params.assunto,
      html: params.html,
      attachments: (params.anexos || []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return { ok: true, remetenteUsado: process.env.SMTP_USER, modo: 'smtp' };
  }

  return {
    ok: false,
    remetenteUsado: emailRemetente,
    modo: 'nao_configurado',
    erro: 'Conecte a Conta Google da Casa em Configurações (ou configure SMTP no servidor) para disparar e-mails.',
  };
}

export function extrairFolderIdDrive(url: string): string {
  const m = (url || '').match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

export async function sincronizarPastaDriveSessao(sessaoId: string): Promise<{
  ok: boolean;
  fotosBaixadas: number;
  videosBaixados: number;
  erro?: string;
}> {
  const sessao = await prisma.sessao.findUnique({
    where: { id: sessaoId },
    include: { homenageados: { orderBy: { ordem: 'asc' } } },
  });
  if (!sessao) return { ok: false, fotosBaixadas: 0, videosBaixados: 0, erro: 'Sessão não encontrada.' };

  const folderId = sessao.driveId || extrairFolderIdDrive(sessao.driveUrl);
  if (!folderId) {
    return { ok: false, fotosBaixadas: 0, videosBaixados: 0, erro: 'Informe um link válido de pasta do Google Drive.' };
  }

  const cfgKey = await prisma.configuracao.findUnique({ where: { chave: 'google_api_key' } });
  const apiKey = descriptografarTexto(cfgKey?.valor) || cfgKey?.valor || '';
  if (!apiKey) {
    return {
      ok: false,
      fotosBaixadas: 0,
      videosBaixados: 0,
      erro: 'Cadastre a Chave da API do Google (Drive) em Configurações.',
    };
  }

  const listarArquivos = async (parentId: string) => {
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size)&key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Google Drive API retornou HTTP ${r.status}. Verifique se a pasta está pública com link.`);
    const j = await r.json();
    return (j.files || []) as { id: string; name: string; mimeType: string; size?: string }[];
  };

  try {
    const itensRaiz = await listarArquivos(folderId);
    const subpastas = itensRaiz.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
    let fotosBaixadas = 0;
    let videosBaixados = 0;

    for (const h of sessao.homenageados) {
      const nomeNorm = h.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const tokens = nomeNorm.split(/\s+/).filter((t) => t.length >= 4);
      const pastaMatch = subpastas.find((sp) => {
        const sn = sp.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return sn.includes(nomeNorm) || tokens.some((tk) => sn.includes(tk));
      });

      if (!pastaMatch) continue;
      const arqs = await listarArquivos(pastaMatch.id);
      const fotosAtuais: { arquivo: string; nomeOriginal: string; origem?: string }[] = JSON.parse(h.fotosJson || '[]');
      let videoAtual = h.videoArquivo;

      for (const arq of arqs) {
        const ehImagem = arq.mimeType.startsWith('image/');
        const ehVideo = arq.mimeType.startsWith('video/');
        if (!ehImagem && !ehVideo) continue;

        const subtipo = ehImagem ? 'fotos' : 'video';
        const dirDest = path.join(process.cwd(), 'storage', 'midia', sessao.id, h.id, subtipo);
        fs.mkdirSync(dirDest, { recursive: true });
        const safeName = arq.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const destFile = path.join(dirDest, safeName);

        if (!fs.existsSync(destFile)) {
          const dlUrl = `https://www.googleapis.com/drive/v3/files/${arq.id}?alt=media&key=${encodeURIComponent(apiKey)}`;
          const dlRes = await fetch(dlUrl);
          if (dlRes.ok) {
            fs.writeFileSync(destFile, Buffer.from(await dlRes.arrayBuffer()));
          } else {
            continue;
          }
        }

        const relUrl = `/midia/${sessao.id}/${h.id}/${subtipo}/${safeName}`;
        if (ehImagem && !fotosAtuais.some((f) => f.arquivo === relUrl)) {
          fotosAtuais.push({ arquivo: relUrl, nomeOriginal: arq.name, origem: 'drive' });
          fotosBaixadas++;
        } else if (ehVideo) {
          videoAtual = relUrl;
          videosBaixados++;
        }
      }

      await prisma.homenageado.update({
        where: { id: h.id },
        data: {
          fotosJson: JSON.stringify(fotosAtuais),
          videoArquivo: videoAtual,
        },
      });
    }

    await registrarAuditoria({
      acao: 'SINCRONIZAR_DRIVE',
      entidade: 'Sessao',
      entidadeId: sessaoId,
      detalhes: `${fotosBaixadas} foto(s) e ${videosBaixados} vídeo(s) sincronizados do Drive`,
    });

    return { ok: true, fotosBaixadas, videosBaixados };
  } catch (err) {
    return {
      ok: false,
      fotosBaixadas: 0,
      videosBaixados: 0,
      erro: err instanceof Error ? err.message : 'Erro ao ler Google Drive.',
    };
  }
}
