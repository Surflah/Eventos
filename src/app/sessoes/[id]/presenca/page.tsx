'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { VereadorSessaoItem } from '@/core/regimento';

export default function PresencaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [presidente, setPresidente] = useState('');
  const [vereadores, setVereadores] = useState<VereadorSessaoItem[]>([]);
  const [autoridades, setAutoridades] = useState('');
  const [jaTinhaAbertura, setJaTinhaAbertura] = useState(false);
  const [atualizarAbertura, setAtualizarAbertura] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/sessoes/${id}`);
    const d = await r.json();
    if (d.ok && d.sessao) {
      setPresidente(d.sessao.presidente || '');
      setVereadores(d.sessao.vereadores || []);
      setAutoridades(d.sessao.autoridades || '');
      setJaTinhaAbertura(Boolean(d.sessao.abertura?.trim()));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await fetch(`/api/sessoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'salvar_sessao',
          presidente,
          vereadores,
          autoridades,
          atualizarAberturaComMesa: jaTinhaAbertura && atualizarAbertura,
          checklist: { presenca: true },
        }),
      });
      router.push(`/sessoes/${id}`);
    } finally {
      setSalvando(false);
    }
  }

  const presentesCount = vereadores.filter((v) => v.presente).length;

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={id} subtitulo="Presença da Sessão" />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <form onSubmit={handleSalvar} className="space-y-6">
          <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-2">
            <h1 className="text-lg font-bold text-[#151a22]">Quem preside</h1>
            <p className="text-xs text-[#5f6b7e]">
              Costuma ser o Presidente da Mesa, mas quem abre a sessão pode ser o Vice. É esse nome que a
              abertura do cerimonial vai anunciar.
            </p>
            <select
              value={presidente}
              onChange={(e) => setPresidente(e.target.value)}
              className="mt-2 w-full max-w-lg rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-sm"
            >
              <option value="">— escolher —</option>
              {vereadores.map((v) => {
                const val = `${v.tratamento} ${v.nome}${v.partido ? ` (${v.partido})` : ''}`;
                return (
                  <option key={v.nome} value={val}>
                    {val}
                    {v.cargo ? ` · ${v.cargo}` : ''}
                  </option>
                );
              })}
            </select>
          </section>

          <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#151a22]">Vereadores presentes</h2>
                <p className="text-xs text-[#5f6b7e]">
                  Sessão solene não é obrigatória para o vereador. Só quem estiver marcado entra na formação
                  da mesa e na chamada dos pronunciamentos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVereadores((p) => p.map((v) => ({ ...v, presente: true })))}
                  className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs hover:bg-[#eef1f7] cursor-pointer"
                >
                  Marcar todos
                </button>
                <button
                  type="button"
                  onClick={() => setVereadores((p) => p.map((v) => ({ ...v, presente: false })))}
                  className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs hover:bg-[#eef1f7] cursor-pointer"
                >
                  Desmarcar todos
                </button>
                <span className="text-xs font-semibold text-[#5f6b7e] tabular-nums">
                  {presentesCount} de {vereadores.length} presentes
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {vereadores.map((v, i) => (
                <label
                  key={v.nome}
                  className={`flex items-center gap-3 rounded-[10px] border p-3 text-sm cursor-pointer ${
                    v.presente
                      ? 'border-emerald-300 bg-emerald-50/50 text-[#151a22]'
                      : 'border-[#dde3ec] bg-[#f8fafc] text-[#5f6b7e]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={v.presente}
                    onChange={(e) =>
                      setVereadores((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, presente: e.target.checked } : x))
                      )
                    }
                    className="h-4 w-4 rounded"
                  />
                  <div>
                    <div className="font-semibold">{v.nome}</div>
                    <div className="text-xs text-[#5f6b7e]">
                      {v.partido}
                      {v.cargo ? ` · ${v.cargo}` : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-2">
            <h2 className="text-base font-bold text-[#151a22]">Autoridades presentes</h2>
            <p className="text-xs text-[#5f6b7e]">
              Uma por linha, com o tratamento como deve ser lido em plenário. Entram na menção das
              autoridades, na abertura.
            </p>
            <textarea
              rows={5}
              value={autoridades}
              onChange={(e) => setAutoridades(e.target.value)}
              className="w-full rounded-[10px] border border-[#dde3ec] p-3 text-sm"
            />
          </section>

          {jaTinhaAbertura && (
            <section className="rounded-[14px] border border-amber-300 bg-amber-50 p-5 text-xs text-amber-950 space-y-1.5">
              <div className="font-bold">Atualização automática da abertura</div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={atualizarAbertura}
                  onChange={(e) => setAtualizarAbertura(e.target.checked)}
                />
                <span>atualizar a abertura com a mesa de agora ao salvar</span>
              </label>
              <p className="text-[11px] text-amber-800">
                Só a abertura é reescrita; os blocos dos homenageados e o encerramento ficam como estão.
              </p>
            </section>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={salvando}
              className="rounded-[10px] bg-[#1f5fe0] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
            >
              {salvando ? 'Salvando...' : 'Salvar presença'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
