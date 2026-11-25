import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const nova = process.env.ADMIN_PASSWORD || process.argv[2];
  if (!nova || nova.length < 6) {
    console.error('Uso: ADMIN_PASSWORD="nova_senha" npm run admin:senha');
    process.exit(1);
  }
  await prisma.configuracao.upsert({
    where: { chave: 'senha_painel_hash' },
    create: { chave: 'senha_painel_hash', valor: hashSenha(nova) },
    update: { valor: hashSenha(nova) },
  });
  console.log('Senha do painel atualizada com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
