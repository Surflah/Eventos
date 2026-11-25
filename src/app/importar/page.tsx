'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { calcularProximaUltimaTerca } from '@/core/regimento';

interface MocaoSaplItem {
  saplMateriaId: number;
  numero: number;
  ano: number;
  mocaoFormatada: string;
  dataApresentacao: string;
  dataAprovacao: string;
  aprovada: boolean;
  pareceHomenagem: boolean;
  ementa: string;
  homenageadoSugerido: string;
  comoChamarSugerido: string;
  motivoSugerido: string;
  proponenteNome: string;
  tratamentoProponente: string;
  partidoProponente: string;
  emailGabinete: string;
  pdfUrl: string;
  jaEntregueSessaoId: string | null;
}

interface ResultadoFilaSapl {
  ano: number;
  prontas: MocaoSaplItem[];
  aprovadasOutras: MocaoSaplItem[];
  naoAprovadas: MocaoSaplItem[];
  jaEntregues: MocaoSaplItem[];
}

function ImportarConteudo() {
  const router = useRouter();
  const sp = useSearchParams();
  const sessaoId = sp.get('s') || '';
  const anoAtual = new Date().getFullYear();
  const anoParam = Number(sp.get('ano') || anoAtual);

  // Passo 1 (quando não há ?s=)
  const [dataSessao, setDataSessao] = useState(() => calcularProximaUltimaTerca());
  const [horaSessao, setHoraSessao] = useState('19:00');
  const [numeroSessao, setNumeroSessao] = useState('');
  const [criandoSessao, setCriandoSessao] = useState(false);

  // Passo 2 (fila do SAPL)
  const [ano, setAno] = useState(anoParam);
  const [progresso, setProgresso] = useState<{ pct: number; msg: string; ativo: boolean }>({
    pct: 0,
    msg: '',
    ativo: false,
  });
  const [fila, setFila] = useState<ResultadoFilaSapl | null>(null);
  const [selecionadasProntas, setSelecionadasProntas] = useState<Record<number, boolean>>({});
  const [selecionadasOutras, setSelecionadasOutras] = useState<Record<number, boolean>>({});
  const [nomesEditados, setNomesEditados] = useState<Record<number, string>>({});
  const [baixarPdf, setBaixarPdf] = useState(true);
  const [importando, setImportando] = useState(false);

  const consultarSapl = useCallback(async (anoAlvo: number, forcar = false) => {
    setProgresso({ pct: 10, msg: `Consultando o SAPL (${anoAlvo})...`, ativo: true });
    try {
      const r = await fetch(`/api/sapl?a=aquecer&ano=${anoAlvo}${forcar ? '&atualizar=1' : ''}`);
      const d = await r.json();
      if (!d.ok || !d.job) {
        setProgresso({ pct: 100, msg: 'Erro ao iniciar consulta ao SAPL.', ativo: false });
        return;
      }

      if (d.job.concluido && d.job.resultado) {
        aplicarResultado(d.job.resultado);
        setProgresso({ pct: 100, msg: '', ativo: false });
        return;
      }

      const jobId = d.job.jobId;
      let tentativas = 0;
      while (tentativas < 90) {
        await new Promise((res) => setTimeout(res, 700));
        const rp = await fetch(`/api/sapl?a=progresso&jobId=${encodeURIComponent(jobId)}`);
        const dp = await rp.json();
        if (!dp.ok || !dp.job) break;

        setProgresso({
          pct: dp.job.percentual || 50,
          msg: dp.job.mensagem || 'Consultando SAPL...',
          ativo: !dp.job.concluido,
        });

        if (dp.job.concluido) {
          if (dp.job.resultado) aplicarResultado(dp.job.resultado);
          break;
        }
        tentativas++;
      }
    } finally {
      setProgresso((prev) => ({ ...prev, ativo: false }));
    }
  }, []);

  function aplicarResultado(res: ResultadoFilaSapl) {
    setFila(res);
    const mapNomes: Record<number, string> = {};
    const selProntas: Record<number, boolean> = {};
    res.prontas.forEach((m) => {
      mapNomes[m.saplMateriaId] = m.homenageadoSugerido;
      selProntas[m.saplMateriaId] = true;
    });
    res.aprovadasOutras.forEach((m) => {
      mapNomes[m.saplMateriaId] = m.homenageadoSugerido;
    });
    setNomesEditados(mapNomes);
    setSelecionadasProntas(selProntas);
    setSelecionadasOutras({});
  }

  useEffect(() => {
    if (sessaoId) {
      void consultarSapl(ano, false);
    }
  }, [sessaoId, ano, consultarSapl]);

  async function handleCriarEBuscar(e: FormEvent) {
    e.preventDefault();
    setCriandoSessao(true);
    try {
      const r = await fetch('/api/sessoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: 'Sessão Solene de Homenagens',
          numero: numeroSessao,
          data: dataSessao,
          hora: horaSessao,
        }),
      });
      const d = await r.json();
      if (d.ok && d.sessao?.id) {
        router.push(`/importar?s=${encodeURIComponent(d.sessao.id)}`);
      }
    } finally {
      setCriandoSessao(false);
    }
  }

  async function handleImportar(origem: 'prontas' | 'outras') {
    if (!fila || !sessaoId) return;
    const fonte = origem === 'prontas' ? fila.prontas : fila.aprovadasOutras;
    const mapaSel = origem === 'prontas' ? selecionadasProntas : selecionadasOutras;

    const escolhidas = fonte
      .filter((m) => mapaSel[m.saplMateriaId])
      .map((m) => ({
        ...m,
        homenageado: (nomesEditados[m.saplMateriaId] || m.homenageadoSugerido).trim(),
      }));

    if (escolhidas.length === 0) return;

    setImportando(true);
    try {
      const r = await fetch('/api/sapl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'importar',
          sessaoId,
          baixarPdf,
          itens: escolhidas,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        router.push(`/sessoes/${sessaoId}`);
      }
    } finally {
      setImportando(false);
    }
  }

  async function handleDevolverFila(m: MocaoSaplItem) {
    await fetch('/api/sapl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'devolver_fila',
        saplMateriaId: m.saplMateriaId,
        numero: m.numero,
        ano: m.ano,
      }),
    });
    await consultarSapl(ano, true);
  }

  if (!sessaoId) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar subtitulo="Nova Sessão pelo SAPL" />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <div className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
            <h1 className="text-xl font-bold text-[#151a22]">Nova sessão solene</h1>
            <p className="mt-1 text-xs leading-relaxed text-[#5f6b7e]">
              A data sugerida é calculada automaticamente como a <strong>última terça-feira do mês</strong>{' '}
              (Regimento Interno, art. 125-A, §2º). Em seguida buscaremos a fila de Moções no SAPL.
            </p>

            <form onSubmit={handleCriarEBuscar} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={dataSessao}
                    onChange={(e) => setDataSessao(e.target.value)}
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">Hora</label>
                  <input
                    type="time"
                    value={horaSessao}
                    onChange={(e) => setHoraSessao(e.target.value)}
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Número / edição
                  </label>
                  <input
                    type="text"
                    value={numeroSessao}
                    onChange={(e) => setNumeroSessao(e.target.value)}
                    placeholder="ex.: 3ª"
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link href="/" className="text-xs font-medium text-[#5f6b7e] hover:underline">
                  ← Voltar ao início
                </Link>
                <button
                  type="submit"
                  disabled={criandoSessao}
                  className="rounded-[10px] bg-[#1f5fe0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#164bb5] disabled:opacity-60 cursor-pointer"
                >
                  {criandoSessao ? 'Criando sessão...' : 'Criar e buscar moções'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={sessaoId} subtitulo={`Fila do SAPL · ${ano}`} />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#151a22]">Fila de Moções no SAPL ({ano})</h1>
            <p className="text-xs text-[#5f6b7e]">
              Moções lidas diretamente de `sapl.itapoa.sc.leg.br` e cruzadas com a Composição da Casa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAno(a)}
                className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  ano === a
                    ? 'bg-[#123f6b] text-white'
                    : 'border border-[#dde3ec] bg-white text-[#151a22] hover:bg-[#eef1f7]'
                }`}
              >
                {a === ano ? `Ano ${a}` : `Ver ${a}`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => consultarSapl(ano, true)}
              className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7] cursor-pointer"
            >
              Atualizar do SAPL
            </button>
            <Link
              href={`/sessoes/${sessaoId}`}
              className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#164bb5]"
            >
              Ir para a montagem →
            </Link>
          </div>
        </div>

        {/* Barra de progresso ao vivo */}
        {progresso.ativo && (
          <div className="rounded-[14px] border border-blue-200 bg-blue-50/80 p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#123f6b] mb-2">
              <span>Consultando o SAPL · {progresso.msg}</span>
              <span className="tabular-nums">{progresso.pct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full bg-[#1f5fe0] transition-all duration-300"
                style={{ width: `${progresso.pct}%` }}
              />
            </div>
          </div>
        )}

        {fila && (
          <>
            {/* 1. Prontas para entrega */}
            <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-[#151a22]">
                    Prontas para entrega ({fila.prontas.length})
                  </h2>
                  <p className="text-xs text-[#5f6b7e]">
                    Moções aprovadas em plenário identificadas como homenagem e ainda não entregues.
                  </p>
                </div>
              </div>

              {fila.prontas.length === 0 ? (
                <p className="py-4 text-xs text-[#5f6b7e]">
                  Nenhuma moção aprovada pendente de entrega neste ano.
                </p>
              ) : (
                <div className="space-y-3">
                  {fila.prontas.map((m) => (
                    <div
                      key={m.saplMateriaId}
                      className="rounded-[12px] border border-[#dde3ec] bg-[#f8fafc] p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={Boolean(selecionadasProntas[m.saplMateriaId])}
                            onChange={(e) =>
                              setSelecionadasProntas((p) => ({
                                ...p,
                                [m.saplMateriaId]: e.target.checked,
                              }))
                            }
                            className="mt-1 h-4 w-4 rounded border-[#dde3ec]"
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#151a22]">
                              <span>Moção nº {m.mocaoFormatada}</span>
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                Aprovada {m.dataAprovacao ? `em ${m.dataAprovacao}` : ''}
                              </span>
                              <span className="text-xs font-normal text-[#5f6b7e]">
                                · {m.tratamentoProponente} {m.proponenteNome}
                                {m.partidoProponente ? ` (${m.partidoProponente})` : ''}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#5f6b7e]">{m.ementa}</p>
                          </div>
                        </label>
                        {m.pdfUrl && (
                          <a
                            href={m.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-[#1f5fe0] hover:underline"
                          >
                            PDF SAPL ↗
                          </a>
                        )}
                      </div>

                      <div className="pl-6">
                        <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                          Nome do homenageado (extraído da ementa — pode ajustar):
                        </label>
                        <input
                          type="text"
                          value={nomesEditados[m.saplMateriaId] ?? m.homenageadoSugerido}
                          onChange={(e) =>
                            setNomesEditados((p) => ({ ...p, [m.saplMateriaId]: e.target.value }))
                          }
                          className="w-full max-w-xl rounded-[8px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-medium text-[#151a22]"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#dde3ec]">
                    <label className="flex items-center gap-2 text-xs text-[#151a22] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={baixarPdf}
                        onChange={(e) => setBaixarPdf(e.target.checked)}
                        className="rounded border-[#dde3ec]"
                      />
                      baixar também o texto da moção do PDF oficial (sem assinaturas digitais)
                    </label>

                    <button
                      type="button"
                      disabled={importando}
                      onClick={() => handleImportar('prontas')}
                      className="rounded-[10px] bg-[#12904a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0c7239] disabled:opacity-60 cursor-pointer"
                    >
                      {importando ? 'Importando e extraindo PDFs...' : 'Importar as marcadas para esta sessão'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 2. Aprovadas, mas não parecem homenagem */}
            <details className="rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs">
              <summary className="cursor-pointer text-sm font-bold text-[#151a22]">
                Aprovadas, mas não parecem homenagem ({fila.aprovadasOutras.length})
              </summary>
              <div className="mt-4 space-y-3">
                {fila.aprovadasOutras.length === 0 ? (
                  <p className="text-xs text-[#5f6b7e]">Nenhum item nesta categoria.</p>
                ) : (
                  <>
                    {fila.aprovadasOutras.map((m) => (
                      <div key={m.saplMateriaId} className="rounded-[10px] border border-[#dde3ec] p-3.5 space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(selecionadasOutras[m.saplMateriaId])}
                            onChange={(e) =>
                              setSelecionadasOutras((p) => ({
                                ...p,
                                [m.saplMateriaId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-[#151a22]">
                              Moção nº {m.mocaoFormatada} · {m.proponenteNome}
                            </div>
                            <p className="text-[#5f6b7e] mt-0.5">{m.ementa}</p>
                          </div>
                        </label>
                        <div className="pl-6">
                          <input
                            type="text"
                            value={nomesEditados[m.saplMateriaId] ?? m.homenageadoSugerido}
                            onChange={(e) =>
                              setNomesEditados((p) => ({ ...p, [m.saplMateriaId]: e.target.value }))
                            }
                            placeholder="Homenageado"
                            className="w-full max-w-lg rounded-[8px] border border-[#dde3ec] px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={importando}
                      onClick={() => handleImportar('outras')}
                      className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
                    >
                      Importar as marcadas
                    </button>
                  </>
                )}
              </div>
            </details>

            {/* 3. Ainda não aprovadas */}
            <details className="rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs">
              <summary className="cursor-pointer text-sm font-bold text-[#151a22]">
                Ainda não aprovadas ({fila.naoAprovadas.length})
              </summary>
              <div className="mt-4 divide-y divide-[#dde3ec]">
                {fila.naoAprovadas.length === 0 ? (
                  <p className="text-xs text-[#5f6b7e]">Nenhuma moção pendente de votação.</p>
                ) : (
                  fila.naoAprovadas.map((m) => (
                    <div key={m.saplMateriaId} className="py-2.5 text-xs">
                      <span className="font-semibold text-[#151a22]">
                        Moção nº {m.mocaoFormatada}
                      </span>{' '}
                      <span className="text-[#5f6b7e]">({m.proponenteNome}) — {m.ementa}</span>
                    </div>
                  ))
                )}
              </div>
            </details>

            {/* 4. Já entregues */}
            <details className="rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs">
              <summary className="cursor-pointer text-sm font-bold text-[#151a22]">
                Já entregues ({fila.jaEntregues.length})
              </summary>
              <div className="mt-4 divide-y divide-[#dde3ec]">
                {fila.jaEntregues.length === 0 ? (
                  <p className="text-xs text-[#5f6b7e]">Nenhuma moção marcada como já entregue neste ano.</p>
                ) : (
                  fila.jaEntregues.map((m) => (
                    <div
                      key={m.saplMateriaId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#151a22]">
                          Moção nº {m.mocaoFormatada}
                        </span>{' '}
                        <span className="text-[#5f6b7e]">
                          · {m.homenageadoSugerido} ({m.proponenteNome})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDevolverFila(m)}
                        className="rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7] cursor-pointer"
                      >
                        Devolver à fila
                      </button>
                    </div>
                  ))
                )}
              </div>
            </details>
          </>
        )}
      </main>
    </div>
  );
}

export default function ImportarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f6fa]" />}>
      <ImportarConteudo />
    </Suspense>
  );
}
