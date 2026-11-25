'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { EstadoPalco, estadoPalcoPadrao } from '@/lib/sse';
import { formatarDataExtenso } from '@/core/regimento';

interface HomTelao {
  id: string;
  nome: string;
  qualificacao: string;
  comoChamar: string;
  mocao: string;
  proponente: string;
  tratamentoProponente: string;
  partidoProponente: string;
  fotos: Array<{ arquivo: string; nomeOriginal: string }>;
  videoArquivo: string | null;
  modoVideo: string;
}

export default function TelaoPalcoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sessao, setSessao] = useState<{
    id: string;
    titulo: string;
    numero: string;
    data: string;
    local: string;
    homenageados: HomTelao[];
  } | null>(null);
  const [estado, setEstado] = useState<EstadoPalco>(() => estadoPalcoPadrao(id));
  const [setupAberto, setSetupAberto] = useState(true);
  const [videosLocais, setVideosLocais] = useState<Record<string, { url: string; nome: string }>>({});
  const [slideIdxLocal, setSlideIdxLocal] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const lastVideoSeqRef = useRef<number>(0);

  const carregar = useCallback(async () => {
    const [rs, rp] = await Promise.all([fetch(`/api/sessoes/${id}`), fetch(`/api/palco/${id}`)]);
    const ds = await rs.json();
    const dp = await rp.json();
    if (ds.ok) setSessao(ds.sessao);
    if (dp.ok && dp.estado) {
      setEstado(dp.estado);
      setSlideIdxLocal(dp.estado.indice || 0);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Comunicação instantânea BroadcastChannel + SSE
  useEffect(() => {
    const bc = new BroadcastChannel(`eventos_ssmh_palco_${id}`);
    bcRef.current = bc;
    bc.postMessage({ tipo: 'telao_pong' });

    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (msg?.tipo === 'ctrl_ping') {
        bc.postMessage({ tipo: 'telao_pong' });
      } else if (msg?.tipo === 'estado' && msg.estado) {
        setEstado(msg.estado);
        setSlideIdxLocal(msg.estado.indice || 0);
      }
    };

    const es = new EventSource(`/api/palco/${id}/stream`);
    es.onmessage = (ev) => {
      try {
        const novo = JSON.parse(ev.data) as EstadoPalco;
        setEstado(novo);
        setSlideIdxLocal(novo.indice || 0);
      } catch {
        // ignore
      }
    };

    return () => {
      bc.close();
      es.close();
    };
  }, [id]);

  // Slideshow automático quando na etapa 'fotos' e não pausado
  useEffect(() => {
    if (estado.etapa !== 'fotos' || estado.pausado || setupAberto) return;
    const ms = Math.max(2000, (estado.intervalo || 6) * 1000);
    const t = setInterval(() => {
      setSlideIdxLocal((prev) => prev + 1);
    }, ms);
    return () => clearInterval(t);
  }, [estado.etapa, estado.pausado, estado.intervalo, estado.hid, setupAberto]);

  // Sincroniza controles de vídeo (play/pause/restart/volume)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = Math.max(0, Math.min(1, (estado.videoVolume ?? 100) / 100));

    if (estado.etapa === 'video') {
      if (estado.videoSeq !== lastVideoSeqRef.current) {
        lastVideoSeqRef.current = estado.videoSeq || 0;
        if (estado.videoAcao === 'pause') {
          vid.pause();
        } else if (estado.videoAcao === 'restart') {
          vid.currentTime = 0;
          void vid.play().catch(() => {});
        } else {
          void vid.play().catch(() => {});
        }
      }
    } else {
      vid.pause();
    }
  }, [estado.etapa, estado.videoAcao, estado.videoSeq, estado.videoVolume, estado.hid]);

  // Atalhos de teclado: F = fullscreen, B = tela preta, L = setup local, Seta Direita = próxima foto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'f') {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen().catch(() => {});
        } else {
          void document.exitFullscreen().catch(() => {});
        }
      } else if (k === 'l') {
        setSetupAberto((p) => !p);
      } else if (k === 'b') {
        setEstado((p) => ({ ...p, telaPreta: !p.telaPreta }));
      } else if (e.key === 'ArrowRight') {
        setSlideIdxLocal((p) => p + 1);
      } else if (e.key === 'ArrowLeft') {
        setSlideIdxLocal((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function voltarParaPlacaAoTerminarVideo(hom: HomTelao) {
    const proximo: Partial<EstadoPalco> = {
      hid: hom.id,
      etapa: 'placa',
      deixa: `${hom.nome} · Entrega / Fala / Foto`,
    };
    const r = await fetch(`/api/palco/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proximo),
    });
    const d = await r.json();
    if (d.ok && d.estado) {
      setEstado(d.estado);
      bcRef.current?.postMessage({ tipo: 'estado', estado: d.estado });
    }
  }

  function vincularArquivoLocal(hid: string, file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideosLocais((prev) => ({ ...prev, [hid]: { url, nome: file.name } }));
  }

  if (!sessao) {
    return <div className="h-screen w-screen bg-[#f6f3ec]" />;
  }

  const homAtual = sessao.homenageados.find((h) => h.id === estado.hid) || sessao.homenageados[0];
  const fotosHom = homAtual?.fotos || [];
  const fotoAtual =
    fotosHom.length > 0 ? fotosHom[slideIdxLocal % fotosHom.length]?.arquivo : null;
  const srcVideo =
    (homAtual && videosLocais[homAtual.id]?.url) || homAtual?.videoArquivo || '';

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none bg-[#f6f3ec] text-[#1b2230]">
      {/* Moldura ornamental sutil de programa solene */}
      <div className="pointer-events-none absolute inset-[2.2vh] border-2 border-[#c9a24a]/65 z-10" />
      <div className="pointer-events-none absolute inset-[2.8vh] border border-[#16357e]/25 z-10" />

      {/* 1. CAMADA ABERTURA */}
      {estado.etapa === 'abertura' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[8vw] text-center animate-fadeIn">
          <img
            src="/img/brasao-camara.png"
            alt=""
            className="h-[18vh] w-auto object-contain mb-[3vh] drop-shadow-sm"
          />
          <div className="text-[1.6vw] font-semibold uppercase tracking-[0.28em] text-[#94711c]">
            Câmara Municipal de Itapoá · Poder Legislativo
          </div>
          <div className="my-[2.2vh] h-[2px] w-[18vw] bg-[#c9a24a]" />
          <h1
            className="text-[4.4vw] font-bold leading-tight text-[#16357e]"
            style={{ fontFamily: 'CinzelLocal, PlayfairLocal, serif' }}
          >
            {sessao.titulo}
          </h1>
          {sessao.numero && (
            <div className="mt-[1.2vh] text-[1.7vw] font-semibold text-[#94711c]">
              {sessao.numero}
            </div>
          )}
          <div className="mt-[3.5vh] text-[1.65vw] font-medium text-[#4a5568]">
            {formatarDataExtenso(sessao.data, true)}
          </div>
        </div>
      )}

      {/* 2. CAMADA TÍTULO DO HOMENAGEADO */}
      {estado.etapa === 'titulo' && homAtual && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[8vw] text-center">
          <div className="rounded-full border border-[#c9a24a] bg-[#efe9dd] px-[2.4vw] py-[0.8vh] text-[1.35vw] font-bold uppercase tracking-[0.22em] text-[#94711c]">
            {homAtual.mocao ? `Moção de Aplausos nº ${homAtual.mocao}` : 'Homenagem Especial'}
          </div>
          <h1
            className="mt-[3.5vh] text-[4.5vw] font-bold leading-tight text-[#16357e]"
            style={{ fontFamily: 'PlayfairLocal, PTSerifLocal, serif' }}
          >
            {homAtual.nome}
          </h1>
          {homAtual.qualificacao && (
            <div className="mt-[1.5vh] text-[2vw] font-medium text-[#4a5568]">
              {homAtual.qualificacao}
            </div>
          )}
          <div className="my-[3.5vh] h-[2px] w-[14vw] bg-[#c9a24a]" />
          <div className="text-[1.55vw] text-[#1b2230]">
            Proposição: <strong>{homAtual.tratamentoProponente} {homAtual.proponente}</strong>
            {homAtual.partidoProponente ? ` (${homAtual.partidoProponente})` : ''}
          </div>
        </div>
      )}

      {/* 3. CAMADA FOTOS + GC */}
      {estado.etapa === 'fotos' && homAtual && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#efe9dd]">
          {fotoAtual ? (
            <>
              {/* Fundo desfocado suave para preencher proporções retrato/paisagem */}
              <img
                src={fotoAtual}
                alt=""
                className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-30 scale-110"
              />
              <div className="relative z-10 flex h-[84vh] w-[88vw] items-center justify-center rounded-xl border border-[#c9a24a]/60 bg-[#fcfaf5]/75 p-[1.8vh] shadow-2xl">
                <img
                  key={fotoAtual}
                  src={fotoAtual}
                  alt={homAtual.nome}
                  className="max-h-full max-w-full rounded-lg object-contain transition-opacity duration-500"
                />
              </div>
            </>
          ) : (
            <div className="text-[2vw] text-[#4a5568]">{homAtual.nome}</div>
          )}

          {/* Barra GC (Gerador de Caracteres) */}
          {estado.gcVisivel && (
            <div
              className={`z-20 rounded-xl border-l-4 border-[#c9a24a] bg-[#0f2559]/92 px-[2.2vw] py-[1.6vh] text-white shadow-2xl backdrop-blur ${
                estado.gcPosicao === 'superior'
                  ? 'absolute top-[5vh] right-[4.5vw] max-w-[44vw]'
                  : 'absolute bottom-[5vh] left-1/2 -translate-x-1/2 min-w-[52vw] max-w-[82vw] text-center'
              }`}
            >
              <div className="text-[1.8vw] font-bold leading-snug">{homAtual.nome}</div>
              <div className="mt-[0.3vh] text-[1.1vw] text-amber-200/95">
                {homAtual.mocao ? `Moção nº ${homAtual.mocao} · ` : ''}
                {homAtual.tratamentoProponente} {homAtual.proponente}
                {homAtual.partidoProponente ? ` (${homAtual.partidoProponente})` : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. CAMADA VÍDEO */}
      {estado.etapa === 'video' && homAtual && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          {srcVideo ? (
            <video
              ref={videoRef}
              src={srcVideo}
              autoPlay
              playsInline
              onEnded={() => voltarParaPlacaAoTerminarVideo(homAtual)}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-center text-white/80 space-y-2">
              <div className="text-2xl font-bold">Nenhum vídeo anexado para {homAtual.nome}</div>
              <div className="text-sm text-white/60">
                Pressione a tecla L neste telão para selecionar o vídeo direto do disco local.
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. CAMADA PLACA OFICIAL (FALA / ENTREGA / FOTO) */}
      {estado.etapa === 'placa' && homAtual && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[8vw] text-center">
          <img
            src="/img/brasao-camara.png"
            alt=""
            className="h-[14vh] w-auto object-contain mb-[2vh]"
          />
          <div className="text-[1.3vw] font-semibold uppercase tracking-[0.26em] text-[#94711c]">
            Câmara Municipal de Itapoá · Moção de Aplausos {homAtual.mocao ? `nº ${homAtual.mocao}` : ''}
          </div>
          <h1
            className="mt-[2.4vh] text-[4.3vw] font-bold leading-tight text-[#16357e]"
            style={{ fontFamily: 'CinzelLocal, PlayfairLocal, serif' }}
          >
            {homAtual.nome}
          </h1>
          {homAtual.qualificacao && (
            <div className="mt-[1.2vh] text-[1.9vw] text-[#4a5568]">{homAtual.qualificacao}</div>
          )}
          <div className="my-[2.8vh] h-[2px] w-[16vw] bg-[#c9a24a]" />
          <div className="text-[1.5vw] font-medium text-[#1b2230]">
            Proposição: <strong>{homAtual.tratamentoProponente} {homAtual.proponente}</strong>
            {homAtual.partidoProponente ? ` (${homAtual.partidoProponente})` : ''}
          </div>
        </div>
      )}

      {/* 6. CAMADA ENCERRAMENTO */}
      {estado.etapa === 'encerramento' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[8vw] text-center">
          <img
            src="/img/brasao-camara.png"
            alt=""
            className="h-[17vh] w-auto object-contain mb-[2.5vh]"
          />
          <div className="text-[1.5vw] font-semibold uppercase tracking-[0.26em] text-[#94711c]">
            Câmara Municipal de Itapoá
          </div>
          <h1
            className="mt-[2vh] text-[4vw] font-bold text-[#16357e]"
            style={{ fontFamily: 'CinzelLocal, PlayfairLocal, serif' }}
          >
            Sessão Solene Encerrada
          </h1>
          <div className="my-[2.4vh] h-[2px] w-[14vw] bg-[#c9a24a]" />
          <div className="text-[1.6vw] text-[#4a5568]">
            Agradecemos a honrosa presença de todos. Uma excelente noite!
          </div>
        </div>
      )}

      {/* CORTINA TELA PRETA (Tecla B) */}
      {estado.telaPreta && <div className="fixed inset-0 z-40 bg-black" />}

      {/* OVERLAY DE PREPARO DO TELÃO (Tecla L) */}
      {setupAberto && (
        <div className="fixed inset-0 z-50 overflow-auto bg-[#f8f6f1]/98 p-8 text-[#151a22] select-text">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#151a22]">Preparo do telão</h2>
                <p className="text-sm text-[#5f6b7e]">
                  Confira os materiais antes de iniciar. Clique em <strong>Iniciar projeção</strong> (que
                  também libera o áudio do navegador) e aperte <strong>F</strong> para tela cheia.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void document.documentElement.requestFullscreen().catch(() => {});
                    setSetupAberto(false);
                  }}
                  className="rounded-[10px] bg-[#1f5fe0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
                >
                  Tela cheia e iniciar (F)
                </button>
                <button
                  type="button"
                  onClick={() => setSetupAberto(false)}
                  className="rounded-[10px] border border-[#dde3ec] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-[#eef1f7] cursor-pointer"
                >
                  Fechar preparo (L)
                </button>
              </div>
            </div>

            <div className="rounded-[14px] border border-[#dde3ec] bg-white p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#151a22]">
                Situação dos materiais e vídeo do disco local{' '}
                <span className="font-normal text-amber-800">
                  — recomendado para arquivo grande sem usar rede
                </span>
              </h3>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#dde3ec] text-[#5f6b7e]">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Homenageado</th>
                    <th className="py-2 pr-3">Fotos</th>
                    <th className="py-2 pr-3">Vídeo no servidor</th>
                    <th className="py-2">Anexar vídeo direto desta máquina</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dde3ec]">
                  {sessao.homenageados.map((h, i) => (
                    <tr key={h.id}>
                      <td className="py-2.5 pr-3 font-bold">{i + 1}</td>
                      <td className="py-2.5 pr-3 font-semibold">{h.nome}</td>
                      <td className="py-2.5 pr-3">{h.fotos.length} foto(s)</td>
                      <td className="py-2.5 pr-3">
                        {h.videoArquivo ? (
                          <span className="text-emerald-700 font-semibold">pronto no servidor</span>
                        ) : (
                          <span className="text-slate-400">não tem</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <label className="inline-flex items-center gap-2 rounded border border-[#dde3ec] bg-[#f8fafc] px-2.5 py-1 font-medium hover:bg-[#eef1f7] cursor-pointer">
                          <span>
                            {videosLocais[h.id]
                              ? `✓ Local: ${videosLocais[h.id].nome}`
                              : 'Escolher vídeo local...'}
                          </span>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => vincularArquivoLocal(h.id, e.target.files?.[0])}
                            className="hidden"
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
