import { NextRequest, NextResponse } from 'next/server';
import { obterUsuarioAtual, registrarAuditoria, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await obterUsuarioAtual();
  if (user) {
    await registrarAuditoria({
      usuario: user.email || user.usuario,
      metodoAuth: user.metodo,
      acao: 'LOGOUT',
      entidade: 'Auth',
      ip: req.headers.get('x-forwarded-for') || 'local',
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const user = await obterUsuarioAtual();
  if (user) {
    await registrarAuditoria({
      usuario: user.email || user.usuario,
      metodoAuth: user.metodo,
      acao: 'LOGOUT',
      entidade: 'Auth',
      ip: req.headers.get('x-forwarded-for') || 'local',
    });
  }
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
