import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/lib/crypto';

const prisma = new PrismaClient();

const VEREADORES_INICIAIS = [
  { nome: 'Ivan Pinto da Luz', tratamento: 'Vereador', partido: 'MDB', cargo: '', ordem: 1, email: 'vereadorivan@camaraitapoa.sc.gov.br', whatsapp: '', ativo: false },
  { nome: 'Daniel Silvano Weber', tratamento: 'Vereador', partido: 'União Brasil', cargo: '1º Secretário', ordem: 2, email: 'vereadordaniel@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Márcio José Puglia de Melo', tratamento: 'Vereador', partido: 'PSD', cargo: 'Presidente', ordem: 3, email: 'vereadormarcio@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Odinei da Silva', tratamento: 'Vereador', partido: 'MDB', cargo: '2º Secretário', ordem: 4, email: 'vereadorodinei@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Ademar Ribas do Valle Filho', tratamento: 'Vereador', partido: 'MDB', cargo: '', ordem: 10, email: 'vereadorademar@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Diego Ângelo Antunes', tratamento: 'Vereador', partido: 'PL', cargo: '', ordem: 10, email: 'vereadordiego@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Jéssica Lana Lemonie', tratamento: 'Vereadora', partido: 'PL', cargo: '', ordem: 10, email: 'vereadorajessica@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Marta Ferreira da Luz', tratamento: 'Vereadora', partido: 'PL', cargo: '', ordem: 10, email: 'vereadoramarta@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Valdecir Antônio Luiz da Silva', tratamento: 'Vereador', partido: 'Avante', cargo: '', ordem: 10, email: 'vereadorvaldecir@camaraitapoa.sc.gov.br', whatsapp: '', ativo: true },
  { nome: 'Wagner Gomes de Souza', tratamento: 'Vereador', partido: 'PSD', cargo: '', ordem: 10, email: 'vereadorwagner@camaraitapoa.sc.gov.br', whatsapp: '', ativo: false },
];

const CONTATOS_INICIAIS = [
  // Vereadores (10)
  { nome: 'Ademar Ribas do Valle Filho', cargo: 'Vereador', email: 'vereadorademar@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'MDB', obs: '', ordem: 1 },
  { nome: 'Daniel Silvano Weber', cargo: '1º Secretário', email: 'vereadordaniel@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'União Brasil', obs: '', ordem: 2 },
  { nome: 'Diego Ângelo Antunes', cargo: 'Vereador', email: 'vereadordiego@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'PL', obs: '', ordem: 3 },
  { nome: 'Ivan Pinto da Luz', cargo: 'Vereador', email: 'vereadorivan@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'MDB', obs: 'TEMPORARIAMENTE LICENCIADO', ordem: 4 },
  { nome: 'Jéssica Lana Lemonie', cargo: 'Vereadora', email: 'vereadorajessica@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'PL', obs: '', ordem: 5 },
  { nome: 'Marta Ferreira da Luz', cargo: 'Vereadora', email: 'vereadoramarta@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'PL', obs: '', ordem: 6 },
  { nome: 'Márcio José Puglia de Melo', cargo: 'Presidente', email: 'vereadormarcio@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'PSD', obs: '', ordem: 7 },
  { nome: 'Odinei da Silva', cargo: '2º Secretário', email: 'vereadorodinei@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'MDB', obs: '', ordem: 8 },
  { nome: 'Valdecir Antônio Luiz da Silva', cargo: 'Vereador', email: 'vereadorvaldecir@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'Avante', obs: '', ordem: 9 },
  { nome: 'Wagner Gomes de Souza', cargo: 'Vereador', email: 'vereadorwagner@camaraitapoa.sc.gov.br', grupo: 'Vereadores', partido: 'PSD', obs: 'TEMPORARIAMENTE LICENCIADO', ordem: 10 },
  // Assessoria parlamentar (11)
  { nome: 'Auria Gonçalves', cargo: 'Assessoria Parlamentar', email: 'auria@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 11 },
  { nome: 'Breno Acácio Bigi', cargo: 'Assessoria Parlamentar', email: 'breno@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 12 },
  { nome: 'Carlos Eduardo Tureck Gomes de Lima', cargo: 'Assessoria Parlamentar', email: 'carlos@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 13 },
  { nome: 'Diogenes Santos Moraes', cargo: 'Assessoria Parlamentar', email: 'diogenes@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 14 },
  { nome: 'Gabriela Kuhnen', cargo: 'Assessoria Parlamentar', email: 'gabriela@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 15 },
  { nome: 'Heloisa Helena Gouveia Bittencourt', cargo: 'Assessoria Parlamentar', email: 'heloisa@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 16 },
  { nome: 'Jacqueline Lizot Araldi', cargo: 'Assessoria Parlamentar', email: 'jacqueline@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 17 },
  { nome: 'João Marcos Ferreira dos Santos', cargo: 'Assessoria Parlamentar', email: 'joao@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 18 },
  { nome: 'Manoel Valdeci Santos', cargo: 'Assessoria Parlamentar', email: 'manoel@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 19 },
  { nome: 'Rogério de Souza', cargo: 'Jurídico / Assessoria', email: 'juridico@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 20 },
  { nome: 'Thomaz William Jansen Sohn', cargo: 'Assessoria Parlamentar', email: 'thomaz@camaraitapoa.sc.gov.br', grupo: 'Assessoria parlamentar', partido: '', obs: '', ordem: 21 },
  // Servidores e setores (18)
  { nome: 'Ana Paula Kogg Stephani', cargo: 'Servidora', email: 'anapaula@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 22 },
  { nome: 'Bruna Pinheiro', cargo: 'Secretaria Geral', email: 'secretariageral@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 23 },
  { nome: 'Daniel Wagner Lamim', cargo: 'Servidor', email: 'daniel@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 24 },
  { nome: 'Elisama de Souza Leite', cargo: 'Servidora', email: 'elisama@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 25 },
  { nome: 'Fernanda Luzia Gutoski Duarte Figueredo', cargo: 'Servidora', email: 'fernanda@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 26 },
  { nome: 'Flávio de Souza Ferreira', cargo: 'Controle Interno', email: 'controleinterno@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 27 },
  { nome: 'Flávio de Souza Ferreira', cargo: 'Tecnologia da Informação', email: 'flavio@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 28 },
  { nome: 'Francisco Xavier Soares Filho', cargo: 'Ouvidoria', email: 'ouvidoria@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 29 },
  { nome: 'Francisco Xavier Soares Filho', cargo: 'Servidor', email: 'francisco@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 30 },
  { nome: 'Jonatas Lennertz', cargo: 'Servidor', email: 'jonatas@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 31 },
  { nome: 'Jope Leão Lobo', cargo: 'Servidor', email: 'jope@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 32 },
  { nome: 'Karolina Vitorino', cargo: 'Servidora', email: 'karolina@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 33 },
  { nome: 'Lilian das Graças Maoski', cargo: 'Servidora', email: 'lilian@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 34 },
  { nome: 'Luiz Guilherme Ferreira Bittencourt', cargo: 'Servidor', email: 'guilherme@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 35 },
  { nome: 'Maria Inês Vargem Yalçinkaya', cargo: 'Servidora', email: 'mari@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 36 },
  { nome: 'Matheus Rocha Nunes', cargo: 'Servidor', email: 'matheus@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 37 },
  { nome: 'Michele Mayer', cargo: 'Servidora', email: 'michele@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 38 },
  { nome: 'Patrícia Carneiro Braz Guerra de Souza', cargo: 'Servidora', email: 'patricia@camaraitapoa.sc.gov.br', grupo: 'Servidores e setores', partido: '', obs: '', ordem: 39 },
  // Canais institucionais (2)
  { nome: 'Protocolo Legislativo', cargo: 'Canal institucional', email: 'protocolo@camaraitapoa.sc.gov.br', grupo: 'Canais institucionais', partido: '', obs: '', ordem: 40 },
  { nome: 'Contato Institucional', cargo: 'Canal institucional', email: 'contato@camaraitapoa.sc.gov.br', grupo: 'Canais institucionais', partido: '', obs: '', ordem: 41 },
];

const MODELOS_PADRAO = [
  {
    codigo: 'convite',
    papel: 'A5-paisagem',
    fundoUrl: '/midia/_fundos/convite.png',
    larguraPx: 1748,
    alturaPx: 1240,
    blocos: [
      { rotulo: 'Corpo do convite', texto: 'A Câmara Municipal de Itapoá tem a honra de convidá-los para a **Sessão Solene Mensal de Homenagens** em razão da Moção de Aplausos {artigo} ##**{nome_completo}**##.', x: 0.5, y: 0.505, largura: 0.86, tamanho: 0.032, entrelinha: 1.25, fonte: 'PTSerif-Regular', align: 'center', ancora: 'meio', cor: '#12263a', cor_destaque: '#17568c', max_linhas: 4, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Número da moção', texto: '(Moção nº {mocao})', x: 0.5, y: 0.61, largura: 0.8, tamanho: 0.03, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'center', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Ícone de data', texto: '', x: 0.162, y: 0.677, largura: 0.1, tamanho: 0.042, entrelinha: 1, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: false, qr: '', icone: 'calendario', oculto: false },
      { rotulo: 'Data', texto: '{data_extenso}', x: 0.205, y: 0.66, largura: 0.7, tamanho: 0.028, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Ícone de hora', texto: '', x: 0.165, y: 0.73, largura: 0.1, tamanho: 0.048, entrelinha: 1, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: false, qr: '', icone: 'relogio', oculto: false },
      { rotulo: 'Hora', texto: '{hora_extenso}', x: 0.205, y: 0.704, largura: 0.7, tamanho: 0.028, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Ícone de local', texto: '', x: 0.167, y: 0.781, largura: 0.1, tamanho: 0.048, entrelinha: 1, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: false, qr: '', icone: 'local', oculto: false },
      { rotulo: 'Local', texto: 'Plenário da Câmara Municipal de Itapoá', x: 0.205, y: 0.75, largura: 0.72, tamanho: 0.028, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Endereço', texto: 'Rua 960, R. 960 Mariana Michels Borges, 1115 - Itapema do Norte, Itapoá - SC, 89360-730', x: 0.205, y: 0.773, largura: 0.72, tamanho: 0.016, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Presidente', texto: '**{presidente}**\nPresidente', x: 0.5, y: 0.862, largura: 0.6, tamanho: 0.029, entrelinha: 1.3, fonte: 'PTSerif-Regular', align: 'center', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 2, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
    ],
  },
  {
    codigo: 'certificado',
    papel: 'A4-paisagem',
    fundoUrl: '/midia/_fundos/certificado.png',
    larguraPx: 2000,
    alturaPx: 1414,
    blocos: [
      { rotulo: 'Conectivo antes do nome', texto: '{artigo}', x: 0.5, y: 0.412, largura: 0.5, tamanho: 0.023, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'center', ancora: 'topo', cor: '#1b2f6b', cor_destaque: '#1b2f6b', max_linhas: 1, maiusculas: true, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Nome do homenageado', texto: '{nome_completo}', x: 0.5, y: 0.478, largura: 0.75, tamanho: 0.047, entrelinha: 1.1, fonte: 'PTSerif-Bold', align: 'center', ancora: 'meio', cor: '#1b2f6b', cor_destaque: '#1b2f6b', max_linhas: 1, maiusculas: true, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Texto da concessão', texto: 'Por propositura {do_proponente} **{tratamento_proponente} {proponente}**, e coautoria de demais vereadores, a Moção n. {mocao} aprovada em plenário em {data_aprovacao}, {motivo}.', x: 0.5, y: 0.64, largura: 0.75, tamanho: 0.023, entrelinha: 1.45, fonte: 'Poppins-Regular', align: 'center', ancora: 'meio', cor: '#1b2f6b', cor_destaque: '#1b2f6b', max_linhas: 5, maiusculas: true, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'QR Code da moção no SAPL', texto: '', x: 0.65, y: 0.86, largura: 0.2, tamanho: 0.115, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#1b2f6b', cor_destaque: '#1b2f6b', max_linhas: 1, maiusculas: false, encolher: false, qr: '{mocao_pdf}', icone: '', oculto: false },
    ],
  },
  {
    codigo: 'convite_geral',
    papel: 'A5-paisagem',
    fundoUrl: '/midia/_fundos/convite_geral.png',
    larguraPx: 1748,
    alturaPx: 1240,
    blocos: [
      { rotulo: 'Corpo do convite', texto: 'A Câmara Municipal de Itapoá tem a honra de convidá-los para a **Sessão Solene Mensal de Homenagens**, em que serão entregues as Moções de Aplausos a {lista_destaque}.', x: 0.5, y: 0.52, largura: 0.85, tamanho: 0.0315, entrelinha: 1.26, fonte: 'PTSerif-Regular', align: 'center', ancora: 'meio', cor: '#12263a', cor_destaque: '#17568c', max_linhas: 8, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Ícone de data', texto: '', x: 0.162, y: 0.664, largura: 0.1, tamanho: 0.034, entrelinha: 1, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: false, qr: '', icone: 'calendario', oculto: false },
      { rotulo: 'Data', texto: '{data_extenso}', x: 0.205, y: 0.66, largura: 0.7, tamanho: 0.028, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Ícone de hora', texto: '', x: 0.165, y: 0.71, largura: 0.1, tamanho: 0.038, entrelinha: 1, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: false, qr: '', icone: 'relogio', oculto: false },
      { rotulo: 'Hora', texto: '{hora_extenso}', x: 0.205, y: 0.704, largura: 0.7, tamanho: 0.028, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Ícone de local', texto: '', x: 0.167, y: 0.756, largura: 0.1, tamanho: 0.038, entrelinha: 1, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: false, qr: '', icone: 'local', oculto: false },
      { rotulo: 'Local', texto: 'Plenário da Câmara Municipal de Itapoá', x: 0.205, y: 0.75, largura: 0.72, tamanho: 0.028, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Endereço', texto: 'Rua 960, R. 960 Mariana Michels Borges, 1115 - Itapema do Norte, Itapoá - SC, 89360-730', x: 0.205, y: 0.773, largura: 0.72, tamanho: 0.015, entrelinha: 1.2, fonte: 'PTSerif-Regular', align: 'left', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 1, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
      { rotulo: 'Presidente', texto: '**{presidente}**\nPresidente', x: 0.5, y: 0.862, largura: 0.6, tamanho: 0.029, entrelinha: 1.3, fonte: 'PTSerif-Regular', align: 'center', ancora: 'topo', cor: '#12263a', cor_destaque: '#12263a', max_linhas: 2, maiusculas: false, encolher: true, qr: '', icone: '', oculto: false },
    ],
  },
];

async function main() {
  const senhaInicial = process.env.ADMIN_INITIAL_PASSWORD || 'camara@1010';

  const configsPadrao: Record<string, string> = {
    senha_painel_hash: hashSenha(senhaInicial),
    remetente_nome: 'Setor de Eventos - Câmara de Itapoá',
    responder_para: 'legislativo@camaraitapoa.sc.gov.br',
    copia_para: 'secretariageral@camaraitapoa.sc.gov.br',
    envio_hora_inicio: '8',
    envio_hora_fim: '19',
    hora_lembretes: '9',
    dominios_login: 'camaraitapoa.sc.gov.br',
    google_casa_email: 'eventos@camaraitapoa.sc.gov.br',
  };

  for (const [chave, valor] of Object.entries(configsPadrao)) {
    const existente = await prisma.configuracao.findUnique({ where: { chave } });
    if (!existente) {
      await prisma.configuracao.create({ data: { chave, valor } });
    }
  }

  const totalVereadores = await prisma.vereador.count();
  if (totalVereadores === 0) {
    await prisma.vereador.createMany({ data: VEREADORES_INICIAIS });
  }

  const totalContatos = await prisma.contatoCasa.count();
  if (totalContatos === 0) {
    await prisma.contatoCasa.createMany({ data: CONTATOS_INICIAIS });
  }

  for (const m of MODELOS_PADRAO) {
    const jaTem = await prisma.modeloArte.findUnique({ where: { codigo: m.codigo } });
    if (!jaTem) {
      await prisma.modeloArte.create({
        data: {
          codigo: m.codigo,
          papel: m.papel,
          fundoUrl: m.fundoUrl,
          larguraPx: m.larguraPx,
          alturaPx: m.alturaPx,
          blocosJson: JSON.stringify(m.blocos),
        },
      });
    }
  }

  console.log('Seed Eventos (SSMH) concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
