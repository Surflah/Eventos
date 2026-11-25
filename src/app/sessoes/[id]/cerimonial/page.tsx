'use client';

import { use, useEffect, useRef, useState } from 'react';
import { compilarDocumentoCerimonial } from '@/core/cerimonial';
import { EstadoPalco } from '@/lib/sse';

export default function CerimonialLeitorTabletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [sessao, setSessao] = useState<{
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
    vereadores: [];
    homenageados: [];
  } | null>(null);

  const [tamanhoFonte, setTamanhoFonte] = useState(20);
  const [seguirAtivo, setSeguirAtivo] = useState(true);
  const [modoEscuro, setModoEscuro] = useState(false);
  const [blocoAtivoId, setBlocoAtivoId] = useState('_abertura');
  const [statusAgora, setStatusAgora] = useState('Aguardando início');

  const refsBlocos = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    fetch(`/api/sessoes/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSessao(d.sessao);
      });
  }, [id]);

  useEffect(() => {
    const aplicarEstado = (est: EstadoPalco) => {
      setStatusAgora(est.deixa || est.etapa.toUpperCase());
      let alvo = '_abertura';
      if (est.etapa === 'encerramento') alvo = '_encerramento';
      else if (est.hid) alvo = est.hid;

      setBlocoAtivoId(alvo);
      if (seguirAtivo && refsBlocos.current[alvo]) {
        refsBlocos.current[alvo]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const bc = new BroadcastChannel(`eventos_ssmh_palco_${id}`);
    bc.onmessage = (ev) => {
      if (ev.data?.tipo === 'estado' && ev.data.estado) {
        aplicarEstado(ev.data.estado);
      }
    };

    const es = new EventSource(`/api/palco/${id}/stream`);
    es.onmessage = (ev) => {
      try {
        aplicarEstado(JSON.parse(ev.data));
      } catch {
        // ignore
      }
    };

    return () => {
      bc.close();
      es.close();
    };
  }, [id, seguirAtivo]);

  if (!sessao) {
    return <div className="p-8 text-center text-sm text-[#5f6b7e]">Carregando leitor...</div>;
  }

  const doc = compilarDocumentoCerimonial(sessao, sessao.homenageados);

  const blocos = [
    {
      hid: '_abertura',
      titulo: 'Abertura',
      quem: 'Mestre de cerimônias / Presidente',
      texto: doc.abertura,
    },
    ...doc.blocosHomenageados,
    {
      hid: '_encerramento',
      titulo: 'Pronunciamentos e Encerramento',
      quem: 'Mestre de cerimônias / Presidente',
      texto: doc.encerramento,
    },
  ];

  return (
    <div
      className={`min-h-screen transition-colors ${
        modoEscuro ? 'bg-[#0f172a] text-slate-100' : 'bg-[#f4f6fa] text-[#151a22]'
      }`}
    >
      {/* Topo fixo ergonômico para Tablet */}
      <header
        className={`sticky top-0 z-30 border-b px-4 py-3 backdrop-blur flex flex-wrap items-center justify-between gap-3 ${
          modoEscuro
            ? 'border-slate-800 bg-[#1e293b]/95'
            : 'border-[#dde3ec] bg-white/95'
        }`}
      >
        <div>
          <div className="text-sm font-bold">{sessao.titulo}</div>
          <div className="text-xs font-medium text-[#1f5fe0]">{statusAgora}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTamanhoFonte((f) => Math.max(14, f - 2))}
            className="min-h-[44px] min-w-[48px] rounded-[10px] border border-[#dde3ec] px-3 text-sm font-bold cursor-pointer"
            title="Diminuir a fonte"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => setTamanhoFonte((f) => Math.min(34, f + 2))}
            className="min-h-[44px] min-w-[48px] rounded-[10px] border border-[#dde3ec] px-3 text-sm font-bold cursor-pointer"
            title="Aumentar a fonte"
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => setModoEscuro((p) => !p)}
            className="min-h-[44px] rounded-[10px] border border-[#dde3ec] px-3.5 text-xs font-semibold cursor-pointer"
          >
            {modoEscuro ? 'Modo Claro' : 'Modo Escuro'}
          </button>
          <button
            type="button"
            onClick={() => setSeguirAtivo((p) => !p)}
            className={`min-h-[44px] rounded-[10px] px-4 text-xs font-bold cursor-pointer ${
              seguirAtivo ? 'bg-[#12904a] text-white' : 'border border-[#dde3ec]'
            }`}
          >
            Seguir: {seguirAtivo ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {blocos.map((b) => {
          const ativo = blocoAtivoId === b.hid;
          return (
            <section
              key={b.hid}
              ref={(el) => {
                refsBlocos.current[b.hid] = el;
              }}
              className={`scroll-mt-24 rounded-2xl border-l-8 p-6 shadow-xs transition-all ${
                ativo
                  ? modoEscuro
                    ? 'border-emerald-400 bg-slate-800 ring-1 ring-emerald-500/40'
                    : 'border-[#12904a] bg-white ring-1 ring-emerald-300'
                  : modoEscuro
                  ? 'border-slate-700 bg-[#1e293b]/75'
                  : 'border-[#dde3ec] bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-lg font-bold">{b.titulo}</h2>
                  <div className="text-xs opacity-70">{b.quem}</div>
                </div>
                {ativo && (
                  <span className="rounded-full bg-[#12904a] px-3 py-1 text-xs font-bold text-white">
                    NO AR AGORA
                  </span>
                )}
              </div>

              <div
                style={{ fontSize: `${tamanhoFonte}px`, lineHeight: 1.65 }}
                className="whitespace-pre-wrap font-sans"
              >
                {b.texto}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
