import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { criptografarTexto, descriptografarTexto } from '@/lib/crypto';
import { criarTokenSessao, registrarAuditoria, SESSION_COOKIE } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const rawState = req.nextUrl.searchParams.get('state') || '';

  let modo: 'login' | 'casa' = 'login';
  let voltar = '/';
  try {
    const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
    if (parsed.modo === 'casa') modo = 'casa';
    if (typeof parsed.voltar === 'string' && parsed.voltar.startsWith('/')) voltar = parsed.voltar;
  } catch {
    // ignore malformed state
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?erro_oauth=Autorização cancelada.', req.url));
  }

  try {
    const [cfgId, cfgSec, cfgDom] = await Promise.all([
      prisma.configuracao.findUnique({ where: { chave: 'google_oauth_client_id' } }),
      prisma.configuracao.findUnique({ where: { chave: 'google_oauth_client_secret_enc' } }),
      prisma.configuracao.findUnique({ where: { chave: 'dominios_login' } }),
    ]);

    const clientId = cfgId?.valor || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = descriptografarTexto(cfgSec?.valor) || process.env.GOOGLE_CLIENT_SECRET || '';
    const appUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, '');
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Falha ao obter token OAuth.');
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userRes.json();
    const email = String(userInfo.email || '').toLowerCase().trim();
    const nome = String(userInfo.name || email);

    if (!email) throw new Error('E-mail não retornado pelo Google.');

    if (modo === 'casa') {
      await prisma.configuracao.upsert({
        where: { chave: 'google_casa_email' },
        create: { chave: 'google_casa_email', valor: email },
        update: { valor: email },
      });
      if (tokenData.refresh_token) {
        await prisma.configuracao.upsert({
          where: { chave: 'google_casa_refresh_token_enc' },
          create: { chave: 'google_casa_refresh_token_enc', valor: criptografarTexto(tokenData.refresh_token) },
          update: { valor: criptografarTexto(tokenData.refresh_token) },
        });
      }
      await prisma.configuracao.upsert({
        where: { chave: 'google_casa_autorizado_em' },
        create: { chave: 'google_casa_autorizado_em', valor: new Date().toISOString() },
        update: { valor: new Date().toISOString() },
      });
      await registrarAuditoria({
        acao: 'CONECTAR_CONTA_GOOGLE_CASA',
        entidade: 'Configuracao',
        detalhes: `Conta institucional conectada: ${email}`,
      });
      return NextResponse.redirect(new URL('/configuracoes?ok=Conta Google da Casa conectada!', req.url));
    }

    // Validação de domínio autorizado ou usuário já registrado
    const dominios = (cfgDom?.valor || 'camaraitapoa.sc.gov.br')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const dominioEmail = email.split('@')[1] || '';
    const existente = await prisma.usuarioPainel.findUnique({ where: { email } });

    if (!dominios.includes(dominioEmail) && !existente) {
      await registrarAuditoria({
        usuario: email,
        metodoAuth: 'google',
        acao: 'LOGIN_DOMINIO_BLOQUEADO',
        entidade: 'Auth',
        detalhes: `Domínio não autorizado: ${dominioEmail}`,
      });
      return NextResponse.redirect(
        new URL(`/login?erro_oauth=${encodeURIComponent(`A conta ${email} não pertence aos domínios autorizados.`)}`, req.url)
      );
    }

    await prisma.usuarioPainel.upsert({
      where: { email },
      create: {
        email,
        nome,
        refreshTokenEnc: tokenData.refresh_token ? criptografarTexto(tokenData.refresh_token) : null,
        podeEnviarEmail: Boolean(tokenData.refresh_token),
        ultimoAcesso: new Date(),
      },
      update: {
        nome,
        ...(tokenData.refresh_token
          ? { refreshTokenEnc: criptografarTexto(tokenData.refresh_token), podeEnviarEmail: true }
          : {}),
        ultimoAcesso: new Date(),
      },
    });

    const jwt = await criarTokenSessao({
      usuario: nome,
      email,
      nome,
      metodo: 'google',
    });

    await registrarAuditoria({
      usuario: email,
      metodoAuth: 'google',
      acao: 'LOGIN_GOOGLE',
      entidade: 'Auth',
      detalhes: `Login Google OAuth (${email})`,
    });

    const res = NextResponse.redirect(new URL(voltar, req.url));
    res.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 16,
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro OAuth Google';
    return NextResponse.redirect(new URL(`/login?erro_oauth=${encodeURIComponent(msg)}`, req.url));
  }
}
