import { cookies } from 'next/headers';
import { prisma } from './prisma';
import {
  criarTokenSessao,
  SESSION_COOKIE,
  SessaoUsuario,
  verificarTokenSessao,
} from './session-token';

export { criarTokenSessao, SESSION_COOKIE, verificarTokenSessao };
export type { SessaoUsuario };

export async function obterUsuarioAtual(): Promise<SessaoUsuario | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return verificarTokenSessao(token);
}

export async function registrarAuditoria(params: {
  usuario?: string;
  metodoAuth?: string;
  acao: string;
  entidade: string;
  entidadeId?: string | number | null;
  detalhes?: string;
  ip?: string | null;
}) {
  try {
    let usuario = params.usuario;
    let metodoAuth = params.metodoAuth;
    if (!usuario) {
      const atual = await obterUsuarioAtual().catch(() => null);
      usuario = atual?.email || atual?.usuario || 'sistema';
      metodoAuth = atual?.metodo || 'sistema';
    }
    await prisma.auditLog.create({
      data: {
        usuario: usuario || 'sistema',
        metodoAuth: metodoAuth || 'senha',
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId != null ? String(params.entidadeId) : null,
        detalhes: params.detalhes ? params.detalhes.slice(0, 2000) : null,
        ip: params.ip || null,
      },
    });
  } catch (err) {
    console.error('Falha ao gravar AuditLog:', err);
  }
}
