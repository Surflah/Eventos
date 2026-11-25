import { extractText } from 'unpdf';
import { prisma } from '@/lib/prisma';

const SAPL_BASE = (process.env.SAPL_BASE_URL || 'https://sapl.itapoa.sc.leg.br').replace(/\/$/, '');

export interface MocaoSaplItem {
  saplMateriaId: number;
  numero: number;
  ano: number;
  mocaoFormatada: string;
  dataApresentacao: string;
  dataAprovacao: string;
  aprovada: boolean;
  emTramitacao: boolean;
  pareceHomenagem: boolean;
  ementa: string;
  homenageadoSugerido: string;
  comoChamarSugerido: string;
  motivoSugerido: string;
  autorBruto: string;
  proponenteNome: string;
  tratamentoProponente: string;
  partidoProponente: string;
  emailGabinete: string;
  pdfUrl: string;
  jaEntregueSessaoId: string | null;
}

export interface ResultadoFilaSapl {
  ano: number;
  atualizadoEm: string;
  prontas: MocaoSaplItem[];
  aprovadasOutras: MocaoSaplItem[];
  naoAprovadas: MocaoSaplItem[];
  jaEntregues: MocaoSaplItem[];
}

export interface ProgressoJobSapl {
  jobId: string;
  ano: number;
  percentual: number;
  mensagem: string;
  concluido: boolean;
  erro?: string;
  resultado?: ResultadoFilaSapl;
}

const globalJobs = globalThis as unknown as {
  saplJobs?: Map<string, ProgressoJobSapl>;
  saplCache?: Map<number, ResultadoFilaSapl>;
  autorCache?: Map<number, string>;
};

const jobsMap = globalJobs.saplJobs ?? new Map<string, ProgressoJobSapl>();
const cacheAnoMap = globalJobs.saplCache ?? new Map<number, ResultadoFilaSapl>();
const autorCacheMap = globalJobs.autorCache ?? new Map<number, string>();
globalJobs.saplJobs = jobsMap;
globalJobs.saplCache = cacheAnoMap;
globalJobs.autorCache = autorCacheMap;

function normalizarUrlSapl(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace(/^http:\/\/sapl\.itapoa\.sc\.leg\.br/i, 'https://sapl.itapoa.sc.leg.br');
}

function normalizarComparacao(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJsonSapl(endpoint: string) {
  const url = endpoint.startsWith('http') ? endpoint : `${SAPL_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EventosSSMH-CamaraItapoa/2.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`SAPL HTTP ${res.status} em ${endpoint}`);
  return res.json();
}

/**
 * Extrai (comoChamar, homenageado, motivo) a partir da ementa oficial da Moção no SAPL.
 */
export function interpretarEmentaMocao(ementa: string): {
  pareceHomenagem: boolean;
  comoChamar: string;
  homenageado: string;
  motivo: string;
} {
  const limpa = (ementa || '').replace(/\s+/g, ' ').trim();
  const ehRepudioOuApelo = /\b(rep[uú]dio|apelo|protesto|apoio legislativo|manifesta apoio)\b/i.test(limpa);
  const ehAplauso = /\b(aplaud|congratul|homenage|parabeniz|reconhec|louvor|m[eé]rito)\w*/i.test(limpa);

  const pareceHomenagem = ehAplauso && !ehRepudioOuApelo;

  // Ex.: "Aplaude e congratula o Grupo De Trilheiros Italama, pela comemoração..."
  // ou "Moção de Aplausos e Congratulações à Senhora Maria..., em reconhecimento..."
  const regexAlvo =
    /(?:aplaude\s+e\s+congratula|congratula\s+e\s+aplaude|aplausos(?:\s+e\s+congratula[cç][oõ]es)?|homenageia|parabeniza)\s+(ao\s+senhor|à\s+senhora|a\s+senhora|o\s+senhor|aos|às|ao|à|os|as|o|a)\s+([^,.;]+?)(?:,\s*(.+?))?\.?$/i;

  const m = limpa.match(regexAlvo);
  if (m) {
    const prepRaw = m[1].toLowerCase().replace(/\s+/g, ' ').trim();
    let comoChamar = 'ao';
    if (prepRaw === 'a' || prepRaw === 'à') comoChamar = 'à';
    else if (prepRaw === 'o' || prepRaw === 'ao') comoChamar = 'ao';
    else if (prepRaw === 'os' || prepRaw === 'aos') comoChamar = 'aos';
    else if (prepRaw === 'as' || prepRaw === 'às') comoChamar = 'às';
    else if (prepRaw.includes('senhora')) comoChamar = 'à senhora';
    else if (prepRaw.includes('senhor')) comoChamar = 'ao senhor';

    const homenageado = m[2].trim().replace(/^["“”']+|["“”']+$/g, '');
    const motivo = (m[3] || '').trim().replace(/\.$/, '');
    return {
      pareceHomenagem,
      comoChamar,
      homenageado,
      motivo,
    };
  }

  return {
    pareceHomenagem,
    comoChamar: 'ao',
    homenageado: limpa.slice(0, 110),
    motivo: limpa,
  };
}

export async function extrairTextoLimpoPdfMocao(bufferOuUrl: Buffer | string): Promise<string> {
  try {
    let bytes: Uint8Array;
    if (typeof bufferOuUrl === 'string') {
      const url = normalizarUrlSapl(bufferOuUrl);
      if (!url) return '';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return '';
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      bytes = new Uint8Array(bufferOuUrl);
    }

    const { text } = await extractText(bytes, { mergePages: true });
    const bruto = Array.isArray(text) ? text.join('\n') : String(text || '');

    // Remove cabeçalhos repetitivos da Câmara, carimbos ICP-Brasil e blocos finais de assinatura
    const linhas = bruto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return true;
        if (/^PODER LEGISLATIVO$/i.test(l)) return false;
        if (/^C[ÂA]MARA MUNICIPAL DE ITAPO[ÁA]/i.test(l)) return false;
        if (/^Rua\s+960|Mariana Michels Borges|CNPJ\s*01\./i.test(l)) return false;
        if (/ICP-Brasil|Assinado digitalmente|autenticidade deste documento|verificador|chave de acesso|documento assinado eletronicamente/i.test(l)) return false;
        if (/^Página\s+\d+\s+de\s+\d+/i.test(l)) return false;
        return true;
      });

    let limpo = linhas.join('\n');
    // Corta a partir de "Câmara Municipal de Itapoá/SC, XX de ... de 20XX." no rodapé de assinatura se vier seguido só de nomes de vereadores
    const idxDataAssinatura = limpo.search(/\nC[âa]mara Municipal de Itapo[áa](?:\/SC)?,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+20\d{2}/i);
    if (idxDataAssinatura > 180) {
      limpo = limpo.slice(0, idxDataAssinatura).trim();
    }

    return limpo.replace(/\n{3,}/g, '\n\n').trim();
  } catch (err) {
    console.warn('Falha ao extrair PDF da moção:', err);
    return '';
  }
}

export function obterCacheFilaSapl(ano: number): ResultadoFilaSapl | null {
  return cacheAnoMap.get(ano) || null;
}

export function obterProgressoJobSapl(jobId: string): ProgressoJobSapl | null {
  return jobsMap.get(jobId) || null;
}

export function iniciarConsultaFilaSapl(ano: number, forcarAtualizacao = false): ProgressoJobSapl {
  if (!forcarAtualizacao && cacheAnoMap.has(ano)) {
    const cached = cacheAnoMap.get(ano)!;
    const pronto: ProgressoJobSapl = {
      jobId: `cached-${ano}`,
      ano,
      percentual: 100,
      mensagem: 'Fila carregada.',
      concluido: true,
      resultado: cached,
    };
    jobsMap.set(pronto.jobId, pronto);
    return pronto;
  }

  const jobId = `sapl-${ano}-${Date.now()}`;
  const job: ProgressoJobSapl = {
    jobId,
    ano,
    percentual: 5,
    mensagem: `Consultando Moções de ${ano} no SAPL...`,
    concluido: false,
  };
  jobsMap.set(jobId, job);

  void executarVarreduraSapl(job);
  return job;
}

async function executarVarreduraSapl(job: ProgressoJobSapl) {
  try {
    const vereadoresCasa = await prisma.vereador.findMany();
    const entreguesDb = await prisma.mocaoEntregueSapl.findMany({ where: { ano: job.ano } });
    const homenageadosSessoes = await prisma.homenageado.findMany({
      where: { saplMateriaId: { not: null } },
      select: { saplMateriaId: true, sessaoId: true },
    });

    const mapaEntregues = new Map<number, string>();
    for (const e of entreguesDb) {
      if (!e.devolvidaFila) mapaEntregues.set(e.saplMateriaId, e.sessaoId || 'sessao-anterior');
    }
    for (const h of homenageadosSessoes) {
      if (h.saplMateriaId) {
        const reg = entreguesDb.find((e) => e.saplMateriaId === h.saplMateriaId);
        if (!reg || !reg.devolvidaFila) {
          mapaEntregues.set(h.saplMateriaId, h.sessaoId);
        }
      }
    }

    // Descobre ID do tipo Moção (padrão 7 no SAPL Itapoá)
    let tipoMocaoId = 7;
    try {
      const tipos = await fetchJsonSapl('/api/materia/tipomaterialegislativa/?page_size=50');
      const achado = (tipos.results || []).find(
        (t: Record<string, unknown>) =>
          /mo[cç][aã]o/i.test(String(t.descricao || '')) || String(t.sigla || '').toUpperCase() === 'MOC'
      );
      if (achado?.id) tipoMocaoId = Number(achado.id);
    } catch {
      // usa 7
    }

    // Pagina todas as moções do ano
    const todasMaterias: Record<string, unknown>[] = [];
    let pagina = 1;
    let totalPaginas = 1;
    do {
      const resp = await fetchJsonSapl(
        `/api/materia/materialegislativa/?tipo=${tipoMocaoId}&ano=${job.ano}&o=-numero&page_size=50&page=${pagina}`
      );
      const lista = Array.isArray(resp.results) ? resp.results : [];
      todasMaterias.push(...lista);
      totalPaginas = Number(resp.pagination?.total_pages || 1);
      pagina++;
    } while (pagina <= totalPaginas && pagina <= 10);

    job.percentual = 25;
    job.mensagem = `${todasMaterias.length} moção(ões) localizada(s) em ${job.ano}. Conferindo votações e autorias...`;

    const itensProcessados: MocaoSaplItem[] = [];
    const loteSize = 6;

    for (let i = 0; i < todasMaterias.length; i += loteSize) {
      const fatia = todasMaterias.slice(i, i + loteSize);
      const resultadosFatia = await Promise.all(
        fatia.map(async (m): Promise<MocaoSaplItem> => {
          const id = Number(m.id);
          const numero = Number(m.numero || 0);
          const ano = Number(m.ano || job.ano);
          const ementa = String(m.ementa || '').trim();
          const emTramitacao = Boolean(m.em_tramitacao);
          const pdfUrl = normalizarUrlSapl(String(m.texto_original || ''));
          const dataApresentacao = String(m.data_apresentacao || '');

          const [autResp, votResp] = await Promise.all([
            fetchJsonSapl(`/api/materia/autoria/?materia=${id}`).catch(() => ({ results: [] })),
            fetchJsonSapl(`/api/sessao/registrovotacao/?materia=${id}`).catch(() => ({ results: [] })),
          ]);

          let autorBruto = '';
          const autPrimeiro = autResp.results?.[0];
          if (autPrimeiro?.autor) {
            const autorId = Number(autPrimeiro.autor);
            if (autorCacheMap.has(autorId)) {
              autorBruto = autorCacheMap.get(autorId)!;
            } else {
              try {
                const aObj = await fetchJsonSapl(`/api/base/autor/${autorId}/`);
                autorBruto = String(aObj.nome || aObj.__str__ || '').trim();
                autorCacheMap.set(autorId, autorBruto);
              } catch {
                autorBruto = '';
              }
            }
          }

          // Casa autor do SAPL com Composição da Casa oficial
          const autorNorm = normalizarComparacao(autorBruto);
          const tokensAutor = autorNorm.split(' ').filter((t) => t.length >= 3);
          const vereadorMatch = vereadoresCasa.find((v) => {
            const vn = normalizarComparacao(v.nome);
            if (!autorNorm) return false;
            if (vn.includes(autorNorm) || autorNorm.includes(vn)) return true;
            return tokensAutor.length > 0 && tokensAutor.every((tk) => vn.includes(tk));
          });

          // Verifica aprovação em plenário (no SAPL Itapoá, tipo_resultado_votacao 1, 2, 4 indicam aprovação; rejeitado costuma ser 3/5)
          const votacoes: Record<string, unknown>[] = Array.isArray(votResp.results) ? votResp.results : [];
          let aprovada = false;
          let dataAprovacao = '';
          if (votacoes.length > 0) {
            const ult = votacoes[votacoes.length - 1];
            const codRes = Number(ult.tipo_resultado_votacao || 0);
            const obsRes = String(ult.observacao || '').toLowerCase();
            if (codRes > 0 && !obsRes.includes('rejeit')) {
              aprovada = true;
            }
            const dh = String(ult.data_hora || '');
            if (dh.includes('T') || dh.includes('-')) {
              const [yy, mm, dd] = dh.slice(0, 10).split('-');
              if (yy && mm && dd) dataAprovacao = `${dd}/${mm}/${yy}`;
            }
          }

          const analise = interpretarEmentaMocao(ementa);
          const jaEntregueSessaoId = mapaEntregues.get(id) || null;

          return {
            saplMateriaId: id,
            numero,
            ano,
            mocaoFormatada: `${numero}/${ano}`,
            dataApresentacao,
            dataAprovacao,
            aprovada,
            emTramitacao,
            pareceHomenagem: analise.pareceHomenagem,
            ementa,
            homenageadoSugerido: analise.homenageado,
            comoChamarSugerido: analise.comoChamar,
            motivoSugerido: analise.motivo,
            autorBruto,
            proponenteNome: vereadorMatch?.nome || autorBruto,
            tratamentoProponente: vereadorMatch?.tratamento || 'Vereador',
            partidoProponente: vereadorMatch?.partido || '',
            emailGabinete: vereadorMatch?.email || '',
            pdfUrl,
            jaEntregueSessaoId,
          };
        })
      );

      itensProcessados.push(...resultadosFatia);
      const frac = Math.min(95, 25 + Math.round(((i + fatia.length) / Math.max(1, todasMaterias.length)) * 70));
      job.percentual = frac;
      job.mensagem = `Analisadas ${Math.min(i + fatia.length, todasMaterias.length)} de ${todasMaterias.length} moções...`;
    }

    const prontas: MocaoSaplItem[] = [];
    const aprovadasOutras: MocaoSaplItem[] = [];
    const naoAprovadas: MocaoSaplItem[] = [];
    const jaEntregues: MocaoSaplItem[] = [];

    for (const item of itensProcessados) {
      if (item.jaEntregueSessaoId) {
        jaEntregues.push(item);
      } else if (item.aprovada && item.pareceHomenagem) {
        prontas.push(item);
      } else if (item.aprovada && !item.pareceHomenagem) {
        aprovadasOutras.push(item);
      } else {
        naoAprovadas.push(item);
      }
    }

    const resultado: ResultadoFilaSapl = {
      ano: job.ano,
      atualizadoEm: new Date().toISOString(),
      prontas,
      aprovadasOutras,
      naoAprovadas,
      jaEntregues,
    };

    cacheAnoMap.set(job.ano, resultado);
    job.percentual = 100;
    job.mensagem = 'Consulta ao SAPL concluída!';
    job.concluido = true;
    job.resultado = resultado;
  } catch (err) {
    job.erro = err instanceof Error ? err.message : 'Falha ao consultar SAPL.';
    job.concluido = true;
    job.percentual = 100;
  }
}
