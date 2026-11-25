import crypto from 'crypto';

export function hashSenha(senha: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const partes = hashArmazenado.split('$');
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
  const [, salt, esperadoHex] = partes;
  const calculado = crypto.scryptSync(senha, salt, 64);
  const esperado = Buffer.from(esperadoHex, 'hex');
  if (calculado.length !== esperado.length) return false;
  return crypto.timingSafeEqual(calculado, esperado);
}

function getChaveCriptografia(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'eventos-ssmh-default-encryption-key-itapoa';
  return crypto.createHash('sha256').update(raw).digest();
}

export function criptografarTexto(texto: string): string {
  if (!texto) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getChaveCriptografia(), iv);
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function descriptografarTexto(cifrado: string | null | undefined): string {
  if (!cifrado) return '';
  try {
    const [ivHex, tagHex, encHex] = cifrado.split(':');
    if (!ivHex || !tagHex || !encHex) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', getChaveCriptografia(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return '';
  }
}

export function gerarTokenSeguro(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function gerarHid(): string {
  return 'h' + crypto.randomBytes(4).toString('hex');
}
