import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verificarTokenSessao } from '@/lib/session-token';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Rotas públicas permitidas sem autenticação
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/enviar') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/midia') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/img') ||
    pathname.startsWith('/fonts') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const sessao = await verificarTokenSessao(token);

  if (!sessao) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    const voltar = pathname + (search || '');
    if (voltar && voltar !== '/') {
      loginUrl.searchParams.set('voltar', voltar);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
