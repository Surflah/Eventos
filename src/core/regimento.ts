import crypto from 'crypto';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

function ultimaTercaDoMesAno(ano: number, mesZeroBased: number): Date {
  const ultimoDia = new Date(ano, mesZeroBased + 1, 0);
  // getDay(): 2 = terça-feira
  const diff = (ultimoDia.getDay() - 2 + 7) % 7;
  return new Date(ano, mesZeroBased, ultimoDia.getDate() - diff);
}

/**
 * Art. 125-A, §2º do Regimento Interno:
 * Calcula a última terça-feira do mês corrente (ou do próximo mês caso já tenha passado).
 */
export function calcularProximaUltimaTerca(ref = new Date()): string {
  const hojeMeiaNoite = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let candidata = ultimaTercaDoMesAno(ref.getFullYear(), ref.getMonth());
  if (candidata < hojeMeiaNoite) {
    const proxMes = ref.getMonth() === 11 ? 0 : ref.getMonth() + 1;
    const proxAno = ref.getMonth() === 11 ? ref.getFullYear() + 1 : ref.getFullYear();
    candidata = ultimaTercaDoMesAno(proxAno, proxMes);
  }
  const yyyy = candidata.getFullYear();
  const mm = String(candidata.getMonth() + 1).padStart(2, '0');
  const dd = String(candidata.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function gerarIdSessaoBase(dataIso: string, titulo: string): string {
  const slug = slugify(titulo || 'sessao-solene-de-homenagens') || 'sessao-solene';
  return `${dataIso}-${slug}`;
}

export function formatarDataCurta(dataIso: string): string {
  if (!dataIso || !dataIso.includes('-')) return dataIso;
  const [y, m, d] = dataIso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatarDataExtenso(dataIso: string, incluirDiaSemana = false): string {
  if (!dataIso || !dataIso.includes('-')) return dataIso;
  const [y, m, d] = dataIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const base = `${dt.getDate()} de ${MESES[dt.getMonth()]} de ${dt.getFullYear()}`;
  return incluirDiaSemana ? `${base} (${DIAS_SEMANA[dt.getDay()]})` : base;
}

export function formatarMesAno(dataIso: string): string {
  if (!dataIso || !dataIso.includes('-')) return dataIso;
  const [y, m] = dataIso.split('-').map(Number);
  const nomeMes = MESES[(m || 1) - 1] || '';
  return `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}/${y}`;
}

export function formatarHoraExtenso(hora: string): string {
  if (!hora) return '19 horas';
  const [hh, mm] = hora.split(':').map(Number);
  if (!mm || mm === 0) return `${hh} horas`;
  return `${hh}h${String(mm).padStart(2, '0')}min`;
}

export function calcularDatasConviteGeral(dataIso: string): {
  sextaAnteriorIso: string;
  sextaAnteriorBr: string;
  vesperaIso: string;
  vesperaBr: string;
} {
  const [y, m, d] = dataIso.split('-').map(Number);
  const dtSessao = new Date(y, (m || 1) - 1, d || 1);
  const vespera = new Date(dtSessao);
  vespera.setDate(dtSessao.getDate() - 1);

  // Sexta-feira (dia 5) imediatamente anterior à sessão
  const sexta = new Date(dtSessao);
  const diffSexta = (dtSessao.getDay() - 5 + 7) % 7 || 7;
  sexta.setDate(dtSessao.getDate() - diffSexta);

  const toIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const sextaIso = toIso(sexta);
  const vesperaIso = toIso(vespera);
  return {
    sextaAnteriorIso: sextaIso,
    sextaAnteriorBr: formatarDataCurta(sextaIso),
    vesperaIso,
    vesperaBr: formatarDataCurta(vesperaIso),
  };
}

export function calcularStatusPrazoMidia(
  dataIso: string,
  prazoReabertoAte?: Date | string | null,
  agora = new Date()
) {
  const [y, m, d] = dataIso.split('-').map(Number);
  // Véspera da sessão às 23:59:59 (-03:00)
  const vesperaFim = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00-03:00`);
  vesperaFim.setSeconds(vesperaFim.getSeconds() - 1);

  let limiteEfetivo = vesperaFim;
  if (prazoReabertoAte) {
    const dtReab = new Date(prazoReabertoAte);
    if (!isNaN(dtReab.getTime()) && dtReab > limiteEfetivo) {
      limiteEfetivo = dtReab;
    }
  }

  const diffMs = limiteEfetivo.getTime() - agora.getTime();
  const encerrado = diffMs <= 0;
  const horasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
  const diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const dtVesp = new Date(y, (m || 1) - 1, (d || 1) - 1);
  const ddMmVespera = `${String(dtVesp.getDate()).padStart(2, '0')}/${String(dtVesp.getMonth() + 1).padStart(2, '0')}`;

  return {
    encerrado,
    horasRestantes,
    diasRestantes,
    ddMmVespera,
    limiteIso: limiteEfetivo.toISOString(),
  };
}

export function pareceEntidadeOuGrupo(nome: string): boolean {
  const padroes =
    /\b(grupo|associa[cç][aã]o|instituto|igreja|caf[eé]|clube|equipe|escola|col[eé]gio|empresa|bombeiros|pol[ií]cia|coral|banda|projeto|ong|funda[cç][aã]o|conselho|c[aâ]mara|centro|comunidade|liga|federa[cç][aã]o|sindicato|cooperativa)\b/i;
  return padroes.test(nome || '');
}

export interface VereadorSessaoItem {
  vereadorId?: number;
  nome: string;
  tratamento: string;
  partido: string;
  cargo: string;
  ordem: number;
  presente: boolean;
}

export function calcularHashMesa(
  presidente: string,
  vereadores: VereadorSessaoItem[],
  autoridades: string
): string {
  const presentes = vereadores
    .filter((v) => v.presente)
    .map((v) => `${v.tratamento}:${v.nome}:${v.partido}`)
    .sort()
    .join('|');
  return crypto
    .createHash('sha1')
    .update(`${presidente.trim()}__${presentes}__${(autoridades || '').trim()}`)
    .digest('hex')
    .slice(0, 16);
}
