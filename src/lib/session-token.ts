import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'eventos_ssmh_session';

export interface SessaoUsuario {
  usuario: string;
  email: string;
  nome: string;
  metodo: 'google' | 'senha';
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'eventos-ssmh-camara-itapoa-fallback-secret-key';
  return new TextEncoder().encode(secret);
}

export async function criarTokenSessao(payload: SessaoUsuario): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('16h')
    .sign(getJwtSecret());
}

export async function verificarTokenSessao(
  token: string | undefined
): Promise<SessaoUsuario | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      usuario: String(payload.usuario || 'Operador'),
      email: String(payload.email || ''),
      nome: String(payload.nome || 'Operador'),
      metodo: payload.metodo === 'google' ? 'google' : 'senha',
    };
  } catch {
    return null;
  }
}
