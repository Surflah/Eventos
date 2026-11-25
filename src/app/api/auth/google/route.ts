import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const modo = req.nextUrl.searchParams.get('modo') === 'casa' ? 'casa' : 'login';
  const voltar = req.nextUrl.searchParams.get('voltar') || '/';

  const cfgClientId = await prisma.configuracao.findUnique({ where: { chave: 'google_oauth_client_id' } });
  const clientId = cfgClientId?.valor || process.env.GOOGLE_CLIENT_ID || '';

  if (!clientId) {
    const erroUrl = new URL(modo === 'casa' ? '/configuracoes' : '/login', req.url);
    erroUrl.searchParams.set('erro_oauth', 'Configure o Client ID OAuth Google nas Configurações (ou use a senha do painel).');
    return NextResponse.redirect(erroUrl);
  }

  const appUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, '');
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.send',
  ];
  if (modo === 'casa') {
    scopes.push('https://www.googleapis.com/auth/drive.file');
  }

  const state = Buffer.from(JSON.stringify({ modo, voltar })).toString('base64url');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
