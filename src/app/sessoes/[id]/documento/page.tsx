'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { compilarDocumentoCerimonial } from '@/core/cerimonial';

export default function DocumentoCerimonialPage({ params }: { params: Promise<{ id: string }> }) {
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
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch(`/api/sessoes/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSessao(d.sessao);
      });
  }, [id]);

  if (!sessao) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar sessaoId={id} />
        <main className="p-8 text-center text-sm text-[#5f6b7e]">Compilando cerimonial...</main>
      </div>
    );
  }

  const doc = compilarDocumentoCerimonial(sessao, sessao.homenageados);

  function baixarTxt() {
    const blob = new Blob([doc.textoCompleto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cerimonial-${sessao?.id || 'sessao'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6fa]">
      <Topbar sessaoId={id} subtitulo="Cerimonial Completo" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#151a22]">Cerimonial completo</h1>
            <p className="text-xs text-[#5f6b7e] tabular-nums">
              {sessao.homenageados.length} moção(ões) · {doc.totalCaracteres.toLocaleString('pt-BR')}{' '}
              caracteres · leitura estimada em {doc.minutosEstimados} minutos
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
            >
              Imprimir / salvar em PDF
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(doc.textoCompleto);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-semibold hover:bg-[#eef1f7] cursor-pointer"
            >
              {copiado ? 'Copiado ✓' : 'Copiar tudo'}
            </button>
            <button
              type="button"
              onClick={baixarTxt}
              className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-semibold hover:bg-[#eef1f7] cursor-pointer"
            >
              Baixar em .txt
            </button>
            <Link
              href={`/sessoes/${id}/cerimonial`}
              className="rounded-[10px] bg-[#12904a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0c7239]"
            >
              Abrir no tablet
            </Link>
          </div>
        </div>

        <article className="rounded-[14px] border border-[#dde3ec] bg-white p-8 shadow-xs print:border-none print:shadow-none print:p-0">
          <pre className="whitespace-pre-wrap font-serif text-[14px] leading-7 text-[#151a22]">
            {doc.textoCompleto}
          </pre>
        </article>
      </main>
    </div>
  );
}
