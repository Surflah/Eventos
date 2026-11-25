'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { formatarDataCurta } from '@/core/regimento';

interface HomTexto {
  id: string;
  nome: string;
  mocao: string;
  proponente: string;
  tratamentoProponente: string;
  textoCerimonial: string;
}

export default function TextosCerimonialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sessao, setSessao] = useState<{
    id: string;
    data: string;
    abertura: string;
    encerramento: string;
    presencaMudouAposAbertura: boolean;
    homenageados: HomTexto[];
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/sessoes/${id}`);
    const d = await r.json();
    if (d.ok) setSessao(d.sessao);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function executarAcao(acao: string) {
    setSalvando(true);
    try {
      const r = await fetch(`/api/sessoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      const d = await r.json();
      if (d.ok && d.sessao) {
        setSessao(d.sessao);
        setMsg('Textos atualizados!');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTudo() {
    if (!sessao) return;
    setSalvando(true);
    try {
      await fetch(`/api/sessoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'salvar_sessao',
          abertura: sessao.abertura,
          encerramento: sessao.encerramento,
          checklist: { textos_dia: true },
        }),
      });
      for (const h of sessao.homenageados) {
        await fetch(`/api/sessoes/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'salvar_homenageado',
            hid: h.id,
            textoCerimonial: h.textoCerimonial,
          }),
        });
      }
      setMsg('Todos os textos do cerimonial foram salvos!');
    } finally {
      setSalvando(false);
    }
  }

  if (!sessao) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar sessaoId={id} />
        <main className="p-8 text-center text-sm text-[#5f6b7e]">Carregando textos...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={id} subtitulo="Textos do Cerimonial" />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#151a22]">Textos do cerimonial</h1>
              <p className="text-xs text-[#5f6b7e]">
                Sessão de {formatarDataCurta(sessao.data)} · {sessao.homenageados.length} homenageado(s)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => executarAcao('gerar_textos_faltantes')}
                className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
              >
                Gerar o que falta
              </button>
              <Link
                href={`/sessoes/${id}/documento`}
                className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-semibold text-[#151a22] hover:bg-[#eef1f7]"
              >
                Ver cerimonial completo
              </Link>
              <Link
                href={`/sessoes/${id}/cerimonial`}
                className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-semibold text-[#151a22] hover:bg-[#eef1f7]"
              >
                Tela do tablet
              </Link>
              <button
                type="button"
                onClick={() => executarAcao('regerar_todos_textos')}
                className="rounded-[10px] border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                Regerar tudo
              </button>
            </div>
          </div>

          <p className="text-xs text-[#5f6b7e]">
            A leitura de cada moção vem do documento oficial do SAPL, sem o bloco de assinaturas e sem o
            carimbo de documento digital. <strong>Gerar o que falta</strong> não encosta no que você já
            escreveu.
          </p>

          {sessao.presencaMudouAposAbertura && (
            <div className="rounded-[10px] border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
              <span>
                A presença mudou depois que a abertura foi gerada, e é ela que traz a composição da mesa
                lida em plenário.
              </span>
              <Link
                href={`/sessoes/${id}/presenca`}
                className="rounded-[8px] bg-amber-700 px-3 py-1 font-semibold text-white hover:bg-amber-800"
              >
                Atualizar em Presença
              </Link>
            </div>
          )}
        </section>

        {msg && (
          <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
            {msg}
          </div>
        )}

        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-2">
          <h2 className="text-base font-bold text-[#151a22]">Abertura</h2>
          <textarea
            rows={14}
            value={sessao.abertura}
            onChange={(e) => setSessao({ ...sessao, abertura: e.target.value })}
            className="w-full rounded-[10px] border border-[#dde3ec] p-3.5 text-xs leading-relaxed font-mono"
          />
        </section>

        {sessao.homenageados.map((h, idx) => (
          <section
            key={h.id}
            className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between">
              <h2 className="text-base font-bold text-[#151a22]">
                {idx + 1}. {h.nome}
              </h2>
              <span className="text-xs text-[#5f6b7e]">
                Moção {h.mocao || '—'} · {h.tratamentoProponente} {h.proponente}
              </span>
            </div>
            <textarea
              rows={14}
              value={h.textoCerimonial}
              onChange={(e) =>
                setSessao({
                  ...sessao,
                  homenageados: sessao.homenageados.map((x) =>
                    x.id === h.id ? { ...x, textoCerimonial: e.target.value } : x
                  ),
                })
              }
              className="w-full rounded-[10px] border border-[#dde3ec] p-3.5 text-xs leading-relaxed font-mono"
            />
          </section>
        ))}

        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-2">
          <h2 className="text-base font-bold text-[#151a22]">Encerramento</h2>
          <textarea
            rows={14}
            value={sessao.encerramento}
            onChange={(e) => setSessao({ ...sessao, encerramento: e.target.value })}
            className="w-full rounded-[10px] border border-[#dde3ec] p-3.5 text-xs leading-relaxed font-mono"
          />
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={salvando}
            onClick={salvarTudo}
            className="rounded-[10px] bg-[#1f5fe0] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
          >
            {salvando ? 'Salvando...' : 'Salvar todos os textos'}
          </button>
        </div>
      </main>
    </div>
  );
}
