import { formatarDataCurta, formatarMesAno, VereadorSessaoItem } from './regimento';

export interface DadosSessaoCerimonial {
  id: string;
  titulo: string;
  numero: string;
  local: string;
  data: string;
  hora: string;
  presidente: string;
  autoridades: string;
  abertura: string;
  encerramento: string;
  vereadores: VereadorSessaoItem[];
}

export interface DadosHomenageadoCerimonial {
  id: string;
  ordem: number;
  nome: string;
  qualificacao: string;
  comoChamar: string;
  mocao: string;
  proponente: string;
  tratamentoProponente: string;
  partidoProponente: string;
  feito: string;
  textoCerimonial: string;
  textoMocao: string;
  modoVideo: string;
  videoArquivo: string | null;
  vaiFalar: string;
  representanteNome: string;
  representanteCargo: string;
}

const LINHA_DIV = '________________________________________________________________________';
const LINHA_DUPLA = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

function normalizarNome(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^vereador(a)?\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

function numeroExtensoPequeno(n: number): string {
  const mapa: Record<number, string> = {
    1: 'uma importante homenagem',
    2: 'duas importantes homenagens',
    3: 'três importantes homenagens',
    4: 'quatro importantes homenagens',
    5: 'cinco importantes homenagens',
    6: 'seis importantes homenagens',
    7: 'sete importantes homenagens',
    8: 'oito importantes homenagens',
    9: 'nove importantes homenagens',
    10: 'dez importantes homenagens',
  };
  return mapa[n] || `${n} importantes homenagens`;
}

export function gerarTextoAbertura(
  sessao: DadosSessaoCerimonial,
  homenageados: DadosHomenageadoCerimonial[]
): string {
  const listaMocoes = homenageados
    .map((h, idx) => {
      const numMocao = h.mocao ? ` nº ${h.mocao}` : '';
      const prop = h.proponente ? ` (${h.proponente})` : '';
      const compl = h.qualificacao ? `, ${h.qualificacao}` : '';
      return `${idx + 1}. Moção de Aplausos${numMocao}${prop} ${h.comoChamar || 'ao'} ${h.nome}${compl}.`;
    })
    .join('\n');

  const presNorm = normalizarNome(sessao.presidente);
  const presentesOrdenados = [...sessao.vereadores]
    .filter((v) => v.presente && normalizarNome(v.nome) !== presNorm)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

  const linhasDemaisVereadores =
    presentesOrdenados.length > 0
      ? presentesOrdenados
          .map((v) => `- ${v.tratamento} ${v.nome}${v.partido ? ` (${v.partido})` : ''}`)
          .join('\n')
      : '- (nenhum outro vereador marcado como presente)';

  const presidenteLinha = sessao.presidente
    ? `- ${sessao.presidente}, Presidente`
    : '- Presidente da Sessão (definir em Presença)';

  const autoridadesLinhas = (sessao.autoridades || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const blocoAutoridades =
    autoridadesLinhas.length > 0
      ? `Agradecemos a presença especialmente dos nossos homenageados e das autoridades presentes:\n\n${autoridadesLinhas.map((a) => `- ${a}`).join('\n')}`
      : 'Agradecemos a presença especialmente dos nossos homenageados e demais autoridades presentes.';

  return [
    '1. ABERTURA',
    '',
    '"Senhoras e senhores, boa noite. A Câmara Municipal de Itapoá tem a honra de acolher a todos para a nossa Sessão Solene Mensal de Homenagens.',
    '',
    'Esta cerimônia cumpre não apenas um rito do nosso Regimento Interno, mas também um dever de justiça e gratidão desta Casa de Leis. O Poder Legislativo Municipal volta os seus olhos para a nossa comunidade com a finalidade de entregar Moções de Aplausos e Congratulações a quem dedica sua vida, seu talento e seu trabalho em prol do desenvolvimento cultural, social e humano de Itapoá."',
    '',
    homenageados.length === 1
      ? 'Nesta sessão, o destaque será voltado para uma importante homenagem:'
      : `Nesta sessão, o destaque será voltado para ${numeroExtensoPequeno(homenageados.length)}:`,
    '',
    listaMocoes || '(Nenhuma moção adicionada até o momento.)',
    '',
    LINHA_DIV,
    '',
    '2. FORMAÇÃO DA MESA',
    '',
    'Convido, neste momento, para compor a Mesa desta Sessão Solene:',
    '',
    presidenteLinha,
    '',
    'Os demais Vereadores e Vereadoras desta Casa Legislativa:',
    '',
    linhasDemaisVereadores,
    '',
    LINHA_DIV,
    '',
    '3. PALAVRA DO PRESIDENTE',
    '',
    'Com nossa mesa formada, passo a palavra ao Presidente desta sessão para a abertura oficial desta solenidade.',
    '',
    'PRESIDENTE: "Boa noite senhoras e senhores, vereadores, vereadoras, autoridades, homenageados, familiares e munícipes que nos acompanham nesta noite especial. Declaro aberta esta Sessão Solene Mensal de Homenagens.',
    '',
    'Esta solenidade cumpre o que prevê o nosso Regimento Interno, mas, muito além de cumprir a lei, ela cumpre o nobre propósito de dar voz à nossa gratidão. Hoje, este Parlamento reconhece publicamente cidadãos e entidades que, por meio de seus atos meritórios, serviços prestados, dedicação e superação, elevam o nome de Itapoá e fazem a verdadeira diferença na nossa coletividade. Sejam todos muito bem-vindos a esta Casa, que é a casa do povo."',
    '',
    LINHA_DIV,
    '',
    '4. MENÇÃO DAS AUTORIDADES',
    '',
    blocoAutoridades,
  ].join('\n');
}

export function gerarBlocoCerimonialHomenageado(
  h: DadosHomenageadoCerimonial,
  numeroSecao: number
): string {
  const ehFemininoProp = h.tratamentoProponente === 'Vereadora';
  const prepProp = ehFemininoProp ? 'à' : 'ao';
  const artProp = ehFemininoProp ? 'a' : 'o';
  const autorLabel = ehFemininoProp ? 'autora' : 'autor';
  const propCompleto = `${h.tratamentoProponente || 'Vereador'} ${h.proponente || 'Proponente'}${
    h.partidoProponente ? ` (${h.partidoProponente})` : ''
  }`;
  const nomeQualif = h.qualificacao ? `${h.nome}, ${h.qualificacao}` : h.nome;

  const textoLeitura =
    (h.textoMocao || '').trim() ||
    (h.feito
      ? `A Câmara Municipal de Itapoá/SC, no uso de suas atribuições legais e regimentais, confere a presente Moção de Aplausos e Congratulações ${h.comoChamar || 'ao'} ${nomeQualif}, ${h.feito}.`
      : `(Texto da moção pendente de preenchimento ou extração do PDF.)`);

  const temVideoComSom = Boolean(h.videoArquivo && h.modoVideo !== 'sem_som');
  const blocoVideo = temVideoComSom
    ? `${numeroSecao}.2 VÍDEO   ← telão: vídeo com áudio\n\nAssistam. (exibição do vídeo — áudio aberto na mesa)`
    : `${numeroSecao}.2 (sem vídeo nesta moção)`;

  let blocoPronunciamento = '';
  if (h.vaiFalar === 'nao') {
    blocoPronunciamento = `${numeroSecao}.6 PRONUNCIAMENTO DO HOMENAGEADO\n\n(Confirmado que não fará uso da palavra nesta homenagem.)`;
  } else {
    let convidadoFala = h.nome;
    if (h.representanteNome?.trim()) {
      convidadoFala = h.representanteCargo?.trim()
        ? `${h.representanteNome.trim()}, ${h.representanteCargo.trim()}`
        : h.representanteNome.trim();
    }
    blocoPronunciamento = `${numeroSecao}.6 PRONUNCIAMENTO DO HOMENAGEADO\n\nNeste momento, convido ${convidadoFala} para fazer o uso da palavra.`;
  }

  const tituloMocao = h.mocao ? `MOÇÃO Nº ${h.mocao} — ${h.nome}` : `HOMENAGEM — ${h.nome}`;
  const refMocao = h.mocao ? `a Moção de Aplausos nº ${h.mocao}` : 'esta homenagem especial';

  return [
    LINHA_DUPLA,
    `${numeroSecao}. ${tituloMocao}`,
    LINHA_DUPLA,
    '',
    `${numeroSecao}.1 LEITURA DA MOÇÃO   ← telão: fotos do homenageado`,
    '',
    textoLeitura,
    '',
    blocoVideo,
    '',
    `${numeroSecao}.3 PALAVRA DO VEREADOR PROPONENTE   ← telão: placa`,
    '',
    `Concedo a palavra ${prepProp} ${propCompleto}, ${autorLabel} desta Moção de Aplausos e Reconhecimento.`,
    '(manifestação)',
    '',
    `${numeroSecao}.4 ENTREGA DA MOÇÃO   ← telão: placa · trilha de fundo`,
    '',
    `O Poder Legislativo de Itapoá confere ${refMocao} ${h.comoChamar || 'ao'} ${nomeQualif}.`,
    `Convidamos agora para vir à frente para proceder a entrega, ${artProp} ${propCompleto}.`,
    'Uma salva de palmas!',
    '',
    `${numeroSecao}.5 FOTOS   ← telão: placa`,
    '',
    `Agora, convido todos os vereadores e ${h.comoChamar || 'ao'} ${h.nome} a se posicionarem à frente para uma foto oficial.`,
    '',
    blocoPronunciamento,
  ].join('\n');
}

export function gerarTextoEncerramento(
  sessao: DadosSessaoCerimonial,
  homenageados: DadosHomenageadoCerimonial[]
): string {
  const proponentesNaSessao = new Set(homenageados.map((h) => normalizarNome(h.proponente)).filter(Boolean));
  const presNorm = normalizarNome(sessao.presidente);

  // Regra regimental/cerimonial: apenas vereadores presentes que NÃO propuseram moção nesta sessão (e exceto o Presidente, que tem fala própria logo a seguir)
  const vereadoresSemMocao = sessao.vereadores.filter(
    (v) =>
      v.presente &&
      !proponentesNaSessao.has(normalizarNome(v.nome)) &&
      normalizarNome(v.nome) !== presNorm
  );

  const secaoVereadoresSemMocao =
    vereadoresSemMocao.length > 0
      ? [
          'Convidamos, ainda, para uso da palavra e prestar sua homenagem os vereadores presentes que não propuseram moção nesta sessão:',
          '',
          ...vereadoresSemMocao.map((v) => `- ${v.tratamento} ${v.nome}${v.partido ? ` (${v.partido})` : ''}`),
          '',
        ].join('\n')
      : '';

  const nomesHomenageados = homenageados.map((h) => h.nome).join(', ') || 'nossos homenageados';
  const numerosMocoes = homenageados
    .map((h) => h.mocao.split('/')[0])
    .filter(Boolean);
  const anoRef = homenageados[0]?.mocao.split('/')[1] || sessao.data.slice(0, 4);
  const resumoMocoes =
    numerosMocoes.length > 1
      ? `Moções ${numerosMocoes.slice(0, -1).join(', ')} e ${numerosMocoes[numerosMocoes.length - 1]} de ${anoRef}`
      : numerosMocoes.length === 1
      ? `Moção ${numerosMocoes[0]} de ${anoRef}`
      : 'homenagens desta noite';

  const nomePresidente = sessao.presidente || 'Presidente desta Casa de Leis';

  return [
    LINHA_DIV,
    '',
    'PRONUNCIAMENTOS',
    '',
    'É momento de abrir espaço para os pronunciamentos, quando a palavra ganha destaque e expressa o reconhecimento desta solenidade.',
    '',
    secaoVereadoresSemMocao,
    'Convidamos, para uso da palavra, o Presidente.',
    '',
    `PRESIDENTE: "Ao nos aproximarmos do encerramento desta solenidade, quero, em nome de toda a Câmara Municipal de Itapoá, expressar o quão gratificante é realizar uma Sessão como a de hoje. O poder público tem o dever de legislar e fiscalizar, mas tem também a obrigação moral de reconhecer aqueles que, de fato, fazem o coração da nossa cidade bater.`,
    '',
    `Nesta noite, homenageamos pilares fundamentais da nossa sociedade: ${nomesHomenageados}.`,
    '',
    'Vocês provam que Itapoá é grande pelo povo maravilhoso que tem. O trabalho, o voluntariado, a resiliência e a dedicação de cada um de vocês são os alicerces do futuro que queremos construir. Parabéns a todos os homenageados desta noite, vocês são o orgulho de nossa cidade!"',
    '',
    LINHA_DIV,
    '',
    'CONSIDERAÇÕES FINAIS (Mestre de Cerimônias)',
    '(Assim que o Presidente terminar o discurso geral, você retoma o microfone e diz:)',
    '',
    'MESTRE DE CERIMÔNIAS:',
    '',
    `Agradecemos as belas palavras do Presidente desta Sessão, ${nomePresidente}.`,
    '',
    `Senhoras e Senhores, estamos chegando ao fim desta Sessão Solene Mensal de Homenagens que teve como destaque a entrega das ${resumoMocoes}.`,
    '',
    'Reiteramos nossa profunda admiração aos homenageados desta noite, que contribuem ativamente para a valorização da nossa cidade.',
    '',
    'Que esta homenagem simbolize não apenas o reconhecimento formal desta Casa de Leis, mas também a imensa gratidão de toda a comunidade pelo talento, pela dedicação e pelas ações brilhantes desenvolvidas pelos nossos homenageados.',
    '',
    LINHA_DIV,
    '',
    'TRANSIÇÃO PARA O ENCERRAMENTO OFICIAL',
    '',
    'MESTRE DE CERIMÔNIAS: "E para proceder o encerramento oficial desta solenidade, retornamos a palavra ao Presidente desta Casa de Leis."',
    '',
    'PRESIDENTE: "Quero nesse momento registrar os agradecimentos a todos os nossos servidores, que prepararam todo este evento com muito carinho, e chegamos, assim, ao final desta Sessão Solene. Em nome da Mesa Diretora e de todos os vereadores desta Casa, agradeço imensamente a presença de todas as autoridades, da imprensa, dos familiares e de cada cidadão que veio prestigiar e aplaudir os nossos homenageados nesta noite tão memorável.',
    '',
    'Que os belos exemplos que foram aplaudidos aqui hoje continuem ecoando por todos os cantos de Itapoá, servindo de inspiração para todos nós. Nada mais havendo a tratar, declaro encerrada a presente Sessão Solene. Desejo a todos um bom retorno aos seus lares, uma excelente noite e que Deus nos abençoe."',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

export function compilarDocumentoCerimonial(
  sessao: DadosSessaoCerimonial,
  homenageados: DadosHomenageadoCerimonial[]
) {
  const abertura = (sessao.abertura || '').trim() || gerarTextoAbertura(sessao, homenageados);
  const encerramento = (sessao.encerramento || '').trim() || gerarTextoEncerramento(sessao, homenageados);

  const blocosHomenageados = homenageados.map((h, idx) => {
    const numeroSecao = idx + 5;
    const texto = (h.textoCerimonial || '').trim() || gerarBlocoCerimonialHomenageado(h, numeroSecao);
    return {
      hid: h.id,
      titulo: `${idx + 1}. ${h.nome}`,
      subtitulo: h.mocao ? `Moção ${h.mocao} · ${h.tratamentoProponente} ${h.proponente}` : h.proponente,
      quem: 'Mestre de cerimônias',
      texto,
    };
  });

  const numerosMocoes = homenageados.map((h) => h.mocao.split('/')[0]).filter(Boolean);
  const anoRef = homenageados[0]?.mocao.split('/')[1] || sessao.data.slice(0, 4);
  const cabecalhoMocoes =
    numerosMocoes.length > 1
      ? `Moções ${numerosMocoes.slice(0, -1).join(', ')} e ${numerosMocoes[numerosMocoes.length - 1]} de ${anoRef}.`
      : numerosMocoes.length === 1
      ? `Moção ${numerosMocoes[0]} de ${anoRef}.`
      : `${homenageados.length} homenagem(ns).`;

  const cabecalho = [
    'CERIMONIAL',
    `${(sessao.titulo || 'SESSÃO SOLENE MENSAL DE HOMENAGENS').toUpperCase()} — ${formatarMesAno(sessao.data)}`,
    `${formatarDataCurta(sessao.data)} — ${sessao.hora}`,
    sessao.local || 'Plenário da Câmara Municipal de Itapoá',
    '',
    `Homenagens: ${cabecalhoMocoes}`,
    LINHA_DIV,
  ].join('\n');

  const textoCompleto = [
    cabecalho,
    '',
    abertura,
    '',
    ...blocosHomenageados.map((b) => b.texto),
    '',
    encerramento,
  ].join('\n');

  const totalCaracteres = textoCompleto.length;
  const minutosEstimados = Math.max(1, Math.round(totalCaracteres / 895));

  return {
    textoCompleto,
    totalCaracteres,
    minutosEstimados,
    abertura,
    encerramento,
    blocosHomenageados,
  };
}

export function gerarItensTabletPresidente(
  sessao: DadosSessaoCerimonial,
  homenageados: DadosHomenageadoCerimonial[]
) {
  const paragrafosHomenageados = homenageados.map((h, i) => {
    const motivoLimpo = (h.feito || '')
      .replace(/^(pela|pelo|em reconhecimento a|em reconhecimento ao|em reconhecimento à|por)\s+/i, '')
      .trim();
    if (motivoLimpo) {
      const verbo = i % 2 === 0 ? 'Celebramos' : 'Aplaudimos';
      return `${verbo} ${motivoLimpo}, com ${h.nome}.`;
    }
    return `Homenageamos com orgulho ${h.nome}${h.mocao ? ` (Moção nº ${h.mocao})` : ''}.`;
  });

  return [
    {
      numero: 1,
      titulo: 'Abertura Oficial',
      ementa: [
        'Boa noite senhoras e senhores, vereadores, vereadoras, autoridades, homenageados, familiares e munícipes que nos acompanham nesta noite especial. Declaro aberta esta Sessão Solene Mensal de Homenagens.',
        '',
        'Esta solenidade cumpre o que prevê o nosso Regimento Interno, mas, muito além de cumprir a lei, ela cumpre o nobre propósito de dar voz à nossa gratidão. Hoje, este Parlamento reconhece publicamente cidadãos e entidades que, por meio de seus atos meritórios, serviços prestados, dedicação e superação, elevam o nome de Itapoá e fazem a verdadeira diferença na nossa coletividade. Sejam todos muito bem-vindos a esta Casa, que é a casa do povo.',
      ].join('\n'),
    },
    {
      numero: 2,
      titulo: 'Pronunciamento Presidencia',
      ementa: [
        'Ao nos aproximarmos do encerramento desta solenidade, quero, em nome de toda a Câmara Municipal de Itapoá, expressar o quão gratificante é realizar uma Sessão como a de hoje. O poder público tem o dever de legislar e fiscalizar, mas tem também a obrigação moral de reconhecer aqueles que, de fato, fazem o coração da nossa cidade bater.',
        '',
        'Nesta noite, homenageamos pilares fundamentais da nossa sociedade.',
        '',
        ...paragrafosHomenageados,
        '',
        'Vocês provam que Itapoá é grande pelo povo maravilhoso que tem. O trabalho, o voluntariado, a resiliência e a dedicação de cada um de vocês são os alicerces do futuro que queremos construir.',
        '',
        'Parabéns a todos os homenageados desta noite, vocês são o orgulho de nossa cidade!',
      ].join('\n'),
    },
    {
      numero: 3,
      titulo: 'Encerramento',
      ementa: [
        'Quero nesse momento registrar os agradecimentos a todos os nossos servidores, que prepararam todo este evento com muito carinho, e chegamos, assim, ao final desta Sessão Solene. Em nome da Mesa Diretora e de todos os vereadores desta Casa, agradeço imensamente a presença de todas as autoridades, da imprensa, dos familiares e de cada cidadão que veio prestigiar e aplaudir os nossos homenageados nesta noite tão memorável.',
        '',
        'Que os belos exemplos que foram aplaudidos aqui hoje continuem ecoando por todos os cantos de Itapoá, servindo de inspiração para todos nós. Nada mais havendo a tratar, declaro encerrada a presente Sessão Solene. Desejo a todos um bom retorno aos seus lares, uma excelente noite e que Deus nos abençoe.',
      ].join('\n'),
    },
  ];
}
