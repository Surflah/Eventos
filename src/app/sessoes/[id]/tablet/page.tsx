'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { formatarDataCurta } from '@/core/regimento';
import { gerarItensTabletPresidente } from '@/core/cerimonial';

export default function TabletPresidentePage({ params }: { params: Promise<{ id: string }> }) {
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
    pautaSessaoId: number | null;
    vereadores: [];
    homenageados: [];
  } | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    mensagem: string;
    urlPainelPauta: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/sessoes/${id}`);
    const d = await r.json();
    if (d.ok) setSessao(d.sessao);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleAtualizarTablet() {
    setSincronizando(true);
    try {
      const r = await fetch(`/api/sessoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'sincronizar_tablet' }),
      });
      const d = await r.json();
      setResultado({
        ok: Boolean(d.ok),
        mensagem: d.mensagem || '',
        urlPainelPauta: d.urlPainelPauta || 'https://pauta.camaraitapoa.sc.gov.br',
      });
      if (d.sessao) setSessao(d.sessao);
    } finally {
      setSincronizando(false);
    }
  }

  if (!sessao) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar sessaoId={id} />
        <main className="p-8 text-center text-sm text-[#5f6b7e]">Carregando...</main>
      </div>
    );
  }

  const itens = gerarItensTabletPresidente(sessao, sessao.homenageados);

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={id} subtitulo="Tablet do Presidente" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div>
            <h1 className="text-xl font-bold text-[#151a22]">Sessão no tablet do presidente</h1>
            <p className="mt-1 text-xs text-[#5f6b7e]">
              Vai direto para o sistema <strong>PautaOnline</strong> como{' '}
              <strong>Sessão Solene Mensal de Homenagens - {formatarDataCurta(sessao.data)}</strong>, com 3
              itens: abertura oficial, pronunciamento da presidência e encerramento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={sincronizando}
              onClick={handleAtualizarTablet}
              className="rounded-[10px] bg-[#1f5fe0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#164bb5] disabled:opacity-60 cursor-pointer"
            >
              {sincronizando ? 'Sincronizando com o PautaOnline...' : 'Atualizar no tablet'}
            </button>

            <a
              href={
                sessao.pautaSessaoId
                  ? `https://pauta.camaraitapoa.sc.gov.br/sessoes/${sessao.pautaSessaoId}/tablet-presidente`
                  : 'https://pauta.camaraitapoa.sc.gov.br'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[10px] border border-[#dde3ec] bg-white px-4 py-2.5 text-xs font-semibold text-[#151a22] hover:bg-[#eef1f7]"
            >
              Abrir o painel da pauta ↗
            </a>
          </div>

          {sessao.pautaSessaoId && !resultado && (
            <p className="text-xs font-medium text-emerald-800">
              ✓ Já vinculada no PautaOnline (Sessão #{sessao.pautaSessaoId}). Clicar novamente atualiza os
              textos sem duplicar itens.
            </p>
          )}

          {resultado && (
            <div
              className={`rounded-[10px] border p-3.5 text-xs font-medium ${
                resultado.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {resultado.mensagem}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-[#5f6b7e]">
            O texto vai pronto e permanece editável no próprio PautaOnline. O que o sistema garante é o que
            costuma falhar na hora: nome certo, número da moção certo, proponente certo e ninguém esquecido
            na ordem.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#5f6b7e]">
            O que vai ser enviado (3 itens)
          </h2>
          {itens.map((it) => (
            <div
              key={it.numero}
              className="rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#123f6b]">
                  {it.numero}. {it.titulo}
                </h3>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(it.ementa)}
                  className="text-xs text-[#1f5fe0] hover:underline cursor-pointer"
                >
                  Copiar fala
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#151a22]">
                {it.ementa}
              </pre>
            </div>
          ))}
        </section>

        <div className="flex justify-between">
          <Link href={`/sessoes/${id}`} className="text-xs font-semibold text-[#5f6b7e] hover:underline">
            ← Voltar ao checklist
          </Link>
        </div>
      </main>
    </div>
  );
}
