'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EstadoPalco, estadoPalcoPadrao } from '@/lib/sse';
import { formatarDataCurta } from '@/core/regimento';

interface HomControle {
  id: string;
  nome: string;
  qualificacao: string;
  mocao: string;
  proponente: string;
  tratamentoProponente: string;
  fotos: Array<{ arquivo: string }>;
  videoArquivo: string | null;
  modoVideo: string;
}

interface TrilhaItem {
  id: number;
  nome: string;
  arquivo: string;
}

export default function ControleOperacaoTiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sessao, setSessao] = useState<{
    id: string;
    titulo: string;
    data: string;
    homenageados: HomControle[];
  } | null>(null);
  const [trilhas, setTrilhas] = useState<TrilhaItem[]>([]);
  const [estado, setEstado] = useState<EstadoPalco>(() => estadoPalcoPadrao(id));
  const [telaoVivo, setTelaoVivo] = useState(false);

  const bcRef = useRef<BroadcastChannel | null>(null);
  const audioTrilhaRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimoPongRef = useRef<number>(0);

  const carregar = useCallback(async () => {
    const [rs, rc, rp] = await Promise.all([
      fetch(`/api/sessoes/${id}`),
      fetch('/api/configuracoes'),
      fetch(`/api/palco/${id}`),
    ]);
    const ds = await rs.json();
    const dc = await rc.json();
    const dp = await rp.json();

    if (ds.ok) setSessao(ds.sessao);
    if (dc.ok) {
      const listaT: TrilhaItem[] = dc.trilhas || [];
      setTrilhas(listaT);
      if (listaT.length > 0 && dp.ok && !dp.estado.trilhaUrl) {
        dp.estado.trilhaUrl = `/midia/_trilhas/${listaT[0].arquivo}`;
      }
    }
    if (dp.ok && dp.estado) setEstado(dp.estado);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Canal local BroadcastChannel + SSE para resposta imediata com o Telão
  useEffect(() => {
    const bc = new BroadcastChannel(`eventos_ssmh_palco_${id}`);
    bcRef.current = bc;

    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (msg?.tipo === 'telao_pong') {
        ultimoPongRef.current = Date.now();
        setTelaoVivo(true);
      } else if (msg?.tipo === 'estado' && msg.estado) {
        setEstado(msg.estado);
      }
    };

    const pingInterval = setInterval(() => {
      bc.postMessage({ tipo: 'ctrl_ping' });
      if (Date.now() - ultimoPongRef.current > 4500) {
        setTelaoVivo(false);
      }
    }, 2000);

    const es = new EventSource(`/api/palco/${id}/stream`);
    es.onmessage = (ev) => {
      try {
        const novo = JSON.parse(ev.data) as EstadoPalco;
        setEstado(novo);
      } catch {
        // ignore
      }
    };

    return () => {
      clearInterval(pingInterval);
      bc.close();
      es.close();
    };
  }, [id]);

  // Atalho de teclado B para Tela Preta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'b') {
        void enviarComando({ telaPreta: !estado.telaPreta });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function enviarComando(parcial: Partial<EstadoPalco>) {
    const proximo: EstadoPalco = {
      ...estado,
      ...parcial,
      sessao: id,
      ts: Date.now(),
    };
    setEstado(proximo);
    bcRef.current?.postMessage({ tipo: 'estado', estado: proximo });

    await fetch(`/api/palco/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parcial),
    });
  }

  function tocarTrilha() {
    const url =
      estado.trilhaUrl || (trilhas[0] ? `/midia/_trilhas/${trilhas[0].arquivo}` : '');
    if (!url) return;

    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    if (!audioTrilhaRef.current) {
      audioTrilhaRef.current = new Audio(url);
      audioTrilhaRef.current.loop = true;
    } else if (!audioTrilhaRef.current.src.endsWith(url)) {
      audioTrilhaRef.current.src = url;
      audioTrilhaRef.current.loop = true;
    }
    audioTrilhaRef.current.volume = Math.max(0, Math.min(1, estado.trilhaVolume / 100));
    void audioTrilhaRef.current.play().catch(() => {});
    void enviarComando({ trilhaUrl: url, trilhaTocando: true });
  }

  function pararTrilhaComFade() {
    const audio = audioTrilhaRef.current;
    if (audio && !audio.paused) {
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = setInterval(() => {
        if (audio.volume > 0.04) {
          audio.volume = Math.max(0, audio.volume - 0.04);
        } else {
          audio.pause();
          audio.currentTime = 0;
          if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
        }
      }, 75);
    }
    void enviarComando({ trilhaTocando: false });
  }

  function abrirJanelaTelao() {
    window.open(
      `/sessoes/${id}/telao`,
      `telao_${id}`,
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    );
  }

  if (!sessao) {
    return (
      <div className="min-h-screen bg-[#0f172a] p-8 text-center text-sm text-slate-300">
        Carregando Console de Operação de TI...
      </div>
    );
  }

  const homAtivo = sessao.homenageados.find((h) => h.id === estado.hid);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* Barra Superior de Broadcast */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#1e293b]/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm font-bold text-white">{sessao.titulo}</div>
              <div className="text-xs text-slate-400">
                {formatarDataCurta(sessao.data)} · {sessao.homenageados.length} homenageado(s)
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  telaoVivo ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-500'
                }`}
              />
              <span className="font-semibold text-slate-200">
                {telaoVivo ? 'Telão conectado' : 'Telão em outra máquina / fechado'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-sky-300 font-medium">
                {estado.telaPreta ? 'TELA PRETA ATIVA' : estado.deixa || estado.etapa.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={abrirJanelaTelao}
              className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
            >
              Abrir telão
            </button>
            <button
              type="button"
              onClick={() =>
                enviarComando({
                  hid: '',
                  etapa: 'abertura',
                  telaPreta: false,
                  deixa: 'Placa de Abertura',
                })
              }
              className={`rounded-[10px] px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                estado.etapa === 'abertura' && !estado.telaPreta
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Placa de abertura
            </button>
            <button
              type="button"
              onClick={() => enviarComando({ telaPreta: !estado.telaPreta })}
              className={`rounded-[10px] px-3.5 py-2 text-xs font-bold cursor-pointer ${
                estado.telaPreta
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'border border-red-800 bg-red-950/60 text-red-300 hover:bg-red-900/60'
              }`}
            >
              Tela preta (B)
            </button>
            <Link
              href={`/sessoes/${id}/cerimonial`}
              target="_blank"
              className="rounded-[10px] border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Tablet Cerimonial ↗
            </Link>
            <Link
              href={`/sessoes/${id}`}
              className="rounded-[10px] border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Montagem
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl grid grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-12">
        {/* Coluna Principal: Homenageados (8 colunas) */}
        <div className="lg:col-span-8 space-y-3">
          {sessao.homenageados.map((h, idx) => {
            const ativo = estado.hid === h.id && !estado.telaPreta;
            return (
              <section
                key={h.id}
                className={`rounded-[14px] border p-4 transition-all ${
                  ativo
                    ? 'border-sky-500 bg-slate-800/95 shadow-lg shadow-sky-950/50'
                    : 'border-slate-800 bg-[#1e293b]/80'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        ativo ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-white">{h.nome}</h2>
                      <div className="text-xs text-slate-400">
                        Moção {h.mocao || '—'} · {h.tratamentoProponente} {h.proponente}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-slate-300 tabular-nums">
                      {h.fotos.length} foto(s)
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 ${
                        h.videoArquivo
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-900 text-slate-500'
                      }`}
                    >
                      {h.videoArquivo ? 'vídeo pronto' : 'sem vídeo'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() =>
                      enviarComando({
                        hid: h.id,
                        etapa: 'titulo',
                        telaPreta: false,
                        deixa: `${idx + 1}. ${h.nome} · Título`,
                      })
                    }
                    className={`rounded-[10px] p-2.5 text-left transition-colors cursor-pointer ${
                      ativo && estado.etapa === 'titulo'
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'border border-slate-700 bg-slate-900/70 hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Título</div>
                    <div className="text-[11px] opacity-75">abre o ciclo</div>
                  </button>

                  <button
                    type="button"
                    disabled={h.fotos.length === 0}
                    onClick={() =>
                      enviarComando({
                        hid: h.id,
                        etapa: 'fotos',
                        indice: 0,
                        pausado: false,
                        telaPreta: false,
                        deixa: `${idx + 1}. ${h.nome} · Leitura / Fotos`,
                      })
                    }
                    className={`rounded-[10px] p-2.5 text-left transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                      ativo && estado.etapa === 'fotos'
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'border border-slate-700 bg-slate-900/70 hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Fotos</div>
                    <div className="text-[11px] opacity-75">durante a leitura</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      enviarComando({
                        hid: h.id,
                        etapa: 'video',
                        videoAcao: 'play',
                        videoSeq: (estado.videoSeq || 0) + 1,
                        telaPreta: false,
                        deixa: `${idx + 1}. ${h.nome} · Vídeo`,
                      })
                    }
                    className={`rounded-[10px] p-2.5 text-left transition-colors cursor-pointer ${
                      ativo && estado.etapa === 'video'
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : h.videoArquivo
                        ? 'border border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50'
                        : 'border border-slate-700 bg-slate-900/70 hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Vídeo</div>
                    <div className="text-[11px] opacity-75">
                      {h.videoArquivo ? 'com áudio' : 'anexar no telão (L)'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      enviarComando({
                        hid: h.id,
                        etapa: 'placa',
                        telaPreta: false,
                        deixa: `${idx + 1}. ${h.nome} · Entrega / Fala / Foto`,
                      })
                    }
                    className={`rounded-[10px] p-2.5 text-left transition-colors cursor-pointer ${
                      ativo && estado.etapa === 'placa'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'border border-slate-700 bg-slate-900/70 hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Placa</div>
                    <div className="text-[11px] opacity-75">fala · entrega · foto</div>
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        {/* Coluna Lateral: Controles de Slideshow, Vídeo, Trilha e Encerramento (4 colunas) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Slideshow */}
          <section className="rounded-[14px] border border-slate-800 bg-[#1e293b] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Slideshow e GC</h2>
              {homAtivo && estado.etapa === 'fotos' && (
                <span className="text-xs text-sky-300 tabular-nums">
                  Foto {(estado.indice % Math.max(1, homAtivo.fotos.length)) + 1}/
                  {homAtivo.fotos.length}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => enviarComando({ indice: Math.max(0, estado.indice - 1) })}
                className="rounded-[8px] border border-slate-700 bg-slate-900 py-2 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                ◀ Foto
              </button>
              <button
                type="button"
                onClick={() => enviarComando({ pausado: true })}
                className={`rounded-[8px] py-2 text-xs font-semibold cursor-pointer ${
                  estado.pausado
                    ? 'bg-amber-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 hover:bg-slate-700'
                }`}
              >
                Pausar
              </button>
              <button
                type="button"
                onClick={() => enviarComando({ pausado: false })}
                className={`rounded-[8px] py-2 text-xs font-semibold cursor-pointer ${
                  !estado.pausado
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-700 bg-slate-900 hover:bg-slate-700'
                }`}
              >
                Seguir
              </button>
              <button
                type="button"
                onClick={() => enviarComando({ indice: estado.indice + 1 })}
                className="rounded-[8px] border border-slate-700 bg-slate-900 py-2 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Foto ▶
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Tempo por foto</span>
                <span className="font-bold tabular-nums">{estado.intervalo}s</span>
              </div>
              <input
                type="range"
                min={3}
                max={15}
                value={estado.intervalo}
                onChange={(e) => enviarComando({ intervalo: Number(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => enviarComando({ gcVisivel: true })}
                className={`rounded-[8px] py-1.5 text-xs font-semibold cursor-pointer ${
                  estado.gcVisivel
                    ? 'bg-sky-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Mostrar GC
              </button>
              <button
                type="button"
                onClick={() => enviarComando({ gcVisivel: false })}
                className={`rounded-[8px] py-1.5 text-xs font-semibold cursor-pointer ${
                  !estado.gcVisivel
                    ? 'bg-slate-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Ocultar GC
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Posição do GC</label>
              <select
                value={estado.gcPosicao}
                onChange={(e) =>
                  enviarComando({ gcPosicao: e.target.value as 'inferior' | 'superior' })
                }
                className="w-full rounded-[8px] border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
              >
                <option value="inferior">Inferior centralizado</option>
                <option value="superior">Superior direito</option>
              </select>
            </div>
          </section>

          {/* Vídeo */}
          <section className="rounded-[14px] border border-slate-800 bg-[#1e293b] p-5 space-y-3">
            <h2 className="text-sm font-bold text-white">Vídeo</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  enviarComando({ videoAcao: 'play', videoSeq: (estado.videoSeq || 0) + 1 })
                }
                className="rounded-[8px] border border-slate-700 bg-slate-900 py-2 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                ▶ Play
              </button>
              <button
                type="button"
                onClick={() =>
                  enviarComando({ videoAcao: 'pause', videoSeq: (estado.videoSeq || 0) + 1 })
                }
                className="rounded-[8px] border border-slate-700 bg-slate-900 py-2 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                ❚❚ Pausar
              </button>
              <button
                type="button"
                onClick={() =>
                  enviarComando({ videoAcao: 'restart', videoSeq: (estado.videoSeq || 0) + 1 })
                }
                className="rounded-[8px] border border-slate-700 bg-slate-900 py-2 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                ↺ Reiniciar
              </button>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Volume do vídeo</span>
                <span className="font-bold tabular-nums">{estado.videoVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={estado.videoVolume}
                onChange={(e) => enviarComando({ videoVolume: Number(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Ao terminar, o telão volta sozinho para a placa do homenageado.
            </p>
          </section>

          {/* Trilha da Entrega */}
          <section className="rounded-[14px] border border-slate-800 bg-[#1e293b] p-5 space-y-3">
            <h2 className="text-sm font-bold text-white">Trilha da entrega</h2>
            <select
              value={estado.trilhaUrl}
              onChange={(e) => enviarComando({ trilhaUrl: e.target.value })}
              className="w-full rounded-[8px] border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
            >
              {trilhas.map((t) => (
                <option key={t.id} value={`/midia/_trilhas/${t.arquivo}`}>
                  {t.nome}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={tocarTrilha}
                className={`rounded-[8px] py-2 text-xs font-semibold cursor-pointer ${
                  estado.trilhaTocando
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-700 bg-slate-900 hover:bg-slate-700'
                }`}
              >
                ▶ Tocar
              </button>
              <button
                type="button"
                onClick={pararTrilhaComFade}
                className="rounded-[8px] border border-slate-700 bg-slate-900 py-2 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Parar (fade)
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Volume da trilha</span>
                <span className="font-bold tabular-nums">{estado.trilhaVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={estado.trilhaVolume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (audioTrilhaRef.current) audioTrilhaRef.current.volume = v / 100;
                  void enviarComando({ trilhaVolume: v });
                }}
                className="w-full accent-emerald-500"
              />
            </div>
          </section>

          {/* Encerramento */}
          <section className="rounded-[14px] border border-slate-800 bg-[#1e293b] p-5 space-y-3">
            <h2 className="text-sm font-bold text-white">Encerramento</h2>
            <button
              type="button"
              onClick={() =>
                enviarComando({
                  hid: '',
                  etapa: 'encerramento',
                  telaPreta: false,
                  deixa: 'Encerramento Oficial',
                })
              }
              className={`w-full rounded-[10px] py-2.5 text-xs font-bold cursor-pointer ${
                estado.etapa === 'encerramento' && !estado.telaPreta
                  ? 'bg-amber-400 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-white hover:bg-slate-700'
              }`}
            >
              Placa de encerramento
            </button>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Atalhos no telão: <strong>F</strong> = tela cheia · <strong>B</strong> = tela preta ·{' '}
              <strong>L</strong> = anexar vídeo local · <strong>→</strong> = próxima foto.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
