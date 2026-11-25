import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureSqliteWal } from '@/lib/prisma';
import { hashSenha, verificarSenha } from '@/lib/crypto';
import { criarTokenSessao, registrarAuditoria, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await ensureSqliteWal();
    const body = await req.json();
    const senha = String(body.senha || '');

    if (!senha) {
      return NextResponse.json({ ok: false, error: 'Informe a senha do painel.' }, { status: 400 });
    }

    let cfg = await prisma.configuracao.findUnique({ where: { chave: 'senha_painel_hash' } });
    if (!cfg) {
      const inicial = process.env.ADMIN_INITIAL_PASSWORD || 'camara@1010';
      cfg = await prisma.configuracao.create({
        data: { chave: 'senha_painel_hash', valor: hashSenha(inicial) },
      });
    }

    const valida = verificarSenha(senha, cfg.valor);
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'local';

    if (!valida) {
      await registrarAuditoria({
        usuario: 'anonimo',
        metodoAuth: 'senha',
        acao: 'LOGIN_FALHA',
        entidade: 'Auth',
        detalhes: 'Tentativa inválida de senha do painel',
        ip,
      });
      return NextResponse.json({ ok: false, error: 'Senha incorreta.' }, { status: 401 });
    }

    const jwt = await criarTokenSessao({
      usuario: 'Operador de TI / Painel',
      email: '',
      nome: 'Operador do Painel',
      metodo: 'senha',
    });

    await registrarAuditoria({
      usuario: 'Operador do Painel',
      metodoAuth: 'senha',
      acao: 'LOGIN_SENHA',
      entidade: 'Auth',
      detalhes: 'Acesso com senha compartilhada do painel',
      ip,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 16,
    });
    return res;
  } catch (err) {
    console.error('Erro em /api/auth/login:', err);
    return NextResponse.json({ ok: false, error: 'Erro interno ao autenticar.' }, { status: 500 });
  }
}
