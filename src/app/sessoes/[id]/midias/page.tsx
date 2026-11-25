'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { calcularStatusPrazoMidia, formatarDataCurta } from '@/core/regimento';

interface HomMidia {
  id: string;
  nome: string;
  mocao: string;
  proponente: string;
  tratamentoProponente: string;
  fotos: Array<{ arquivo: string; nomeOriginal: string }>;
  videoArquivo: string | null;
  uploadToken: string;
  prazoReabertoAte: string | null;
}

export default function MidiasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sessao, setSessao] = useState<{
    id: string;
    titulo: string;
    data: string;
    homenageados: HomMidia[];
  } | null>(null);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/sessoes/${id}`);
    const d = await r.json();
    if (d.ok) setSessao(d.sessao);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function reabrirPrazo24h(hid: string) {
    const novaData = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await fetch(`/api/sessoes/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'salvar_homenageado',
        hid,
        prazoReabertoAte: novaData,
      }),
    });
    setMsg('Prazo estendido por +24 horas para este homenageado!');
    await carregar();
  }

  if (!sessao) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar sessaoId={id} />
        <main className="p-8 text-center text-sm text-[#5f6b7e]">Carregando mídias...</main>
      </div>
    );
  }

  const prazoGeral = calcularStatusPrazoMidia(sessao.data);

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={id} subtitulo="Conferência de Mídias" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#151a22]">Mídias recebidas</h1>
            <p className="text-xs text-[#5f6b7e]">
              Sessão de {formatarDataCurta(sessao.data)} · O link público fecha automaticamente na véspera
              ({prazoGeral.ddMmVespera} às 23:59) —{' '}
              <strong>
                {prazoGeral.encerrado
                  ? 'prazo encerrado'
                  : `${prazoGeral.horasRestantes} hora(s) restante(s)`}
              </strong>
              .
            </p>
          </div>
          <Link
            href={`/sessoes/${id}/controle`}
            className="rounded-[10px] bg-[#123f6b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e5a99]"
          >
            Painel da TI
          </Link>
        </div>

        {msg && (
          <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
            {msg}
          </div>
        )}

        <div className="space-y-4">
          {sessao.homenageados.map((h, idx) => {
            const prazoHom = calcularStatusPrazoMidia(sessao.data, h.prazoReabertoAte);
            return (
              <section
                key={h.id}
                className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#151a22]">
                      {idx + 1}. {h.nome}
                    </h2>
                    <p className="text-xs text-[#5f6b7e]">
                      Moção {h.mocao || '—'} · {h.tratamentoProponente} {h.proponente} ·{' '}
                      <strong>{h.fotos.length} foto(s)</strong> ·{' '}
                      <strong>{h.videoArquivo ? '1 vídeo' : 'sem vídeo'}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/enviar/${h.uploadToken}`;
                        void navigator.clipboard.writeText(url);
                        setMsg(`Link copiado: ${url}`);
                      }}
                      className="rounded-[8px] border border-[#dde3ec] px-3 py-1.5 text-xs font-medium hover:bg-[#eef1f7] cursor-pointer"
                    >
                      Copiar link do portal
                    </button>
                    {prazoHom.encerrado && (
                      <button
                        type="button"
                        onClick={() => reabrirPrazo24h(h.id)}
                        className="rounded-[8px] border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                      >
                        Liberar +24h
                      </button>
                    )}
                  </div>
                </div>

                {h.fotos.length === 0 && !h.videoArquivo ? (
                  <p className="rounded-[10px] bg-[#f8fafc] p-4 text-xs text-[#5f6b7e]">
                    Nenhum arquivo enviado até o momento.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {h.fotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8">
                        {h.fotos.map((f) => (
                          <a
                            key={f.arquivo}
                            href={f.arquivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square overflow-hidden rounded-[8px] border border-[#dde3ec] bg-[#f8fafc]"
                          >
                            <img
                              src={f.arquivo}
                              alt={f.nomeOriginal}
                              className="h-full w-full object-cover hover:scale-105 transition-transform"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    {h.videoArquivo && (
                      <div className="flex items-center gap-3 rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] p-3 text-xs">
                        <span className="font-semibold text-[#151a22]">Vídeo recebido:</span>
                        <a
                          href={h.videoArquivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#1f5fe0] hover:underline"
                        >
                          Abrir vídeo ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
