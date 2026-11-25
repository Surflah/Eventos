'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Topbar } from '@/components/Topbar';
import { pareceEntidadeOuGrupo } from '@/core/regimento';

interface HomPronunc {
  id: string;
  nome: string;
  mocao: string;
  proponente: string;
  tratamentoProponente: string;
  vaiFalar: string;
  representanteNome: string;
  representanteCargo: string;
}

export default function PronunciamentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lista, setLista] = useState<HomPronunc[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/sessoes/${id}`);
    const d = await r.json();
    if (d.ok && d.sessao) setLista(d.sessao.homenageados || []);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarItem(h: HomPronunc) {
    setSalvandoId(h.id);
    setMsg('');
    try {
      await fetch(`/api/sessoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'salvar_homenageado',
          hid: h.id,
          vaiFalar: h.vaiFalar,
          representanteNome: h.representanteNome,
          representanteCargo: h.representanteCargo,
        }),
      });
      setMsg(`Pronunciamento de "${h.nome}" salvo!`);
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={id} subtitulo="Pronunciamentos" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
        <div className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
          <h1 className="text-xl font-bold text-[#151a22]">Uso da palavra pelos homenageados</h1>
          <p className="mt-1 text-xs text-[#5f6b7e]">
            Defina se cada homenageado falará na tribuna e, quando for entidade ou grupo, quem recebe a
            moção e fala em nome dela.
          </p>
        </div>

        {msg && (
          <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
            {msg}
          </div>
        )}

        {lista.map((h, idx) => {
          const ehGrupo = pareceEntidadeOuGrupo(h.nome);
          return (
            <section
              key={h.id}
              className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-[#151a22]">
                      {idx + 1}. {h.nome}
                    </h2>
                    {ehGrupo && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        parece entidade ou grupo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5f6b7e]">
                    Moção {h.mocao || '—'} · {h.tratamentoProponente} {h.proponente}
                  </p>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#151a22] mb-2">
                  Vai usar a palavra?
                </span>
                <div className="flex flex-wrap gap-3 text-xs">
                  {[
                    ['sim', 'Sim, vai falar'],
                    ['nao', 'Não vai falar'],
                    ['indefinido', 'Ainda não sei'],
                  ].map(([val, label]) => (
                    <label
                      key={val}
                      className={`flex items-center gap-2 rounded-[10px] border px-3.5 py-2 cursor-pointer ${
                        h.vaiFalar === val
                          ? 'border-[#1f5fe0] bg-blue-50 font-semibold text-[#1f5fe0]'
                          : 'border-[#dde3ec] bg-[#f8fafc] text-[#151a22]'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`fala_${h.id}`}
                        checked={h.vaiFalar === val}
                        onChange={() =>
                          setLista((p) => p.map((x) => (x.id === h.id ? { ...x, vaiFalar: val } : x)))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Quem recebe e fala (ex.: o Sr. Carlos Henrique Sanches)
                  </label>
                  <input
                    type="text"
                    value={h.representanteNome}
                    onChange={(e) =>
                      setLista((p) =>
                        p.map((x) =>
                          x.id === h.id ? { ...x, representanteNome: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Em branco, usa o próprio nome do homenageado"
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Cargo ou relação (ex.: presidente do grupo)
                  </label>
                  <input
                    type="text"
                    value={h.representanteCargo}
                    onChange={(e) =>
                      setLista((p) =>
                        p.map((x) =>
                          x.id === h.id ? { ...x, representanteCargo: e.target.value } : x
                        )
                      )
                    }
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={salvandoId === h.id}
                  onClick={() => salvarItem(h)}
                  className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
                >
                  {salvandoId === h.id ? 'Salvando...' : 'Salvar pronunciamento'}
                </button>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
