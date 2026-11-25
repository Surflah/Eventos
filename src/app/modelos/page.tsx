'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import type { BlocoModelo } from '@/services/arte.service';

const FONTES_OPCOES = [
  'PTSerif-Regular',
  'PTSerif-Bold',
  'Cinzel-Regular',
  'Cinzel-Bold',
  'PlayfairDisplay-Regular',
  'PlayfairDisplay-Bold',
  'GreatVibes-Regular',
  'Poppins-Regular',
  'Poppins-SemiBold',
  'Poppins-Bold',
];

const MARCADORES = [
  '{nome}',
  '{titulo}',
  '{nome_completo}',
  '{artigo}',
  '{mocao}',
  '{proponente}',
  '{tratamento_proponente}',
  '{partido_proponente}',
  '{data_aprovacao}',
  '{motivo}',
  '{data_extenso}',
  '{data}',
  '{hora}',
  '{hora_extenso}',
  '{presidente}',
  '{casa}',
  '{municipio}',
  '{mocao_pdf}',
  '{lista_destaque}',
];

function ModelosConteudo() {
  const sp = useSearchParams();
  const sessaoId = sp.get('s') || '';
  const inicial = sp.get('m') || 'convite';

  const [aba, setAba] = useState<'convite' | 'certificado' | 'convite_geral'>(
    inicial === 'certificado' || inicial === 'convite_geral' ? inicial : 'convite'
  );
  const [papel, setPapel] = useState('A5-paisagem');
  const [dimensoes, setDimensoes] = useState({ w: 1748, h: 1240, fundoUrl: '' });
  const [blocos, setBlocos] = useState<BlocoModelo[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [previewHash, setPreviewHash] = useState(() => Date.now());

  const carregar = useCallback(async (cod: string) => {
    const r = await fetch(`/api/modelos?m=${cod}`);
    const d = await r.json();
    if (d.ok && d.modelo) {
      setPapel(d.modelo.papel || 'A5-paisagem');
      setDimensoes({
        w: d.modelo.larguraPx,
        h: d.modelo.alturaPx,
        fundoUrl: d.modelo.fundoUrl,
      });
      setBlocos(d.modelo.blocos || []);
      setPreviewHash(Date.now());
    }
  }, []);

  useEffect(() => {
    void carregar(aba);
  }, [aba, carregar]);

  async function salvarModelo() {
    setSalvando(true);
    setAviso('');
    try {
      const r = await fetch('/api/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: aba, papel, blocos }),
      });
      const d = await r.json();
      if (d.ok) {
        setPreviewHash(Date.now());
        setAviso('Modelo salvo e pré-visualização atualizada!');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function handleUploadFundo(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append('codigo', aba);
    fd.append('fundo', file);
    const r = await fetch('/api/modelos', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.ok) {
      setDimensoes({ w: d.larguraPx, h: d.alturaPx, fundoUrl: d.fundoUrl });
      setPreviewHash(Date.now());
      setAviso(`Arte de fundo atualizada (${d.larguraPx}×${d.alturaPx} px)!`);
    }
  }

  function atualizarBloco(idx: number, parcial: Partial<BlocoModelo>) {
    setBlocos((prev) => prev.map((b, i) => (i === idx ? { ...b, ...parcial } : b)));
  }

  function adicionarBloco() {
    setBlocos((prev) => [
      ...prev,
      {
        rotulo: 'Novo campo',
        texto: '',
        x: 0.5,
        y: 0.5,
        largura: 0.7,
        tamanho: 0.028,
        entrelinha: 1.25,
        fonte: 'PTSerif-Regular',
        align: 'center',
        ancora: 'topo',
        cor: '#12263a',
        cor_destaque: '#17568c',
        max_linhas: 2,
        maiusculas: false,
        encolher: true,
        qr: '',
        icone: '',
        oculto: false,
      },
    ]);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={sessaoId || undefined} subtitulo="Editor de Modelos Gráficos" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        {/* Abas acessíveis (modern-web-guidance: tabs) */}
        <div role="tablist" aria-label="Modelos de arte" className="ssmh-tablist bg-white rounded-t-[14px] px-4 pt-2 border border-b-0 border-[#dde3ec]">
          {(
            [
              ['convite', 'Convite'],
              ['certificado', 'Certificado da moção'],
              ['convite_geral', 'Convite geral'],
            ] as const
          ).map(([cod, label]) => (
            <button
              key={cod}
              type="button"
              role="tab"
              aria-selected={aba === cod}
              onClick={() => setAba(cod)}
              className="ssmh-tab text-sm font-semibold"
            >
              {label}
            </button>
          ))}
        </div>

        {aviso && (
          <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
            {aviso}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Coluna Esquerda: Preview Vivo + Arte de Fundo */}
          <div className="lg:col-span-5 space-y-5">
            <section className="sticky top-20 space-y-4">
              <div className="rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#151a22]">Pré-visualização</h2>
                  <button
                    type="button"
                    onClick={salvarModelo}
                    disabled={salvando}
                    className="rounded-[10px] bg-[#1f5fe0] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
                  >
                    {salvando ? 'Renderizando...' : 'Salvar e atualizar preview'}
                  </button>
                </div>
                <img
                  src={`/api/arte?m=${aba}${sessaoId ? `&s=${sessaoId}` : ''}&w=720&v=${previewHash}`}
                  alt="Preview do modelo"
                  className="w-full rounded-[10px] border border-[#dde3ec] bg-[#faf7f0]"
                />
                <div className="flex justify-between text-[11px] text-[#5f6b7e]">
                  <span>
                    Resolução base: {dimensoes.w}×{dimensoes.h} px
                  </span>
                  <a
                    href={`/api/arte?m=${aba}${sessaoId ? `&s=${sessaoId}` : ''}&f=pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#1f5fe0] hover:underline"
                  >
                    Testar PDF em tamanho real ↗
                  </a>
                </div>
              </div>

              <div className="rounded-[14px] border border-[#dde3ec] bg-white p-5 shadow-xs space-y-3">
                <h2 className="text-sm font-bold text-[#151a22]">Arte de fundo</h2>
                <p className="text-xs leading-relaxed text-[#5f6b7e]">
                  Exporte do Canva <strong>sem os textos que mudam</strong> (nome, moção, proponente, data)
                  e deixe só a moldura, o brasão e o que é fixo. PNG na maior resolução possível.
                </p>
                <label className="inline-flex items-center gap-2 rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] px-3.5 py-2 text-xs font-semibold text-[#151a22] hover:bg-[#eef1f7] cursor-pointer">
                  <span>Enviar nova arte de fundo (PNG/JPG/WebP)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleUploadFundo(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              </div>
            </section>
          </div>

          {/* Coluna Direita: Papel, Marcadores e Blocos */}
          <div className="lg:col-span-7 space-y-5">
            <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-[#151a22]">Textos e posicionamento</h2>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-[#5f6b7e]">Papel do PDF:</label>
                  <select
                    value={papel}
                    onChange={(e) => setPapel(e.target.value)}
                    className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    <option value="A4-paisagem">A4 deitado</option>
                    <option value="A4-retrato">A4 em pé</option>
                    <option value="A5-paisagem">A5 deitado</option>
                    <option value="A5-retrato">A5 em pé</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#5f6b7e]">
                  Marcadores disponíveis (clique para copiar):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MARCADORES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => navigator.clipboard.writeText(m)}
                      className="rounded bg-[#eef1f7] px-2 py-0.5 font-mono text-[11px] text-[#151a22] hover:bg-blue-100 cursor-pointer"
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#5f6b7e] pt-1">
                  Dentro do texto: <code className="bg-[#eef1f7] px-1 rounded">**negrito**</code> e{' '}
                  <code className="bg-[#eef1f7] px-1 rounded">##cor de destaque##</code>.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {blocos.map((b, idx) => (
                  <details
                    key={idx}
                    open={idx < 2}
                    className="rounded-[12px] border border-[#dde3ec] bg-[#f8fafc] p-4"
                  >
                    <summary className="cursor-pointer flex items-center justify-between text-xs font-bold text-[#151a22]">
                      <span>
                        #{idx + 1} · {b.rotulo || (b.icone ? `Ícone: ${b.icone}` : b.qr ? 'QR Code' : 'Bloco')}
                        {b.oculto ? ' (oculto)' : ''}
                      </span>
                      <span className="text-[11px] font-normal text-[#5f6b7e]">
                        x={b.x} · y={b.y}
                      </span>
                    </summary>

                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                            Rótulo
                          </label>
                          <input
                            type="text"
                            value={b.rotulo}
                            onChange={(e) => atualizarBloco(idx, { rotulo: e.target.value })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                              Ícone
                            </label>
                            <select
                              value={b.icone || ''}
                              onChange={(e) => atualizarBloco(idx, { icone: e.target.value })}
                              className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1.5 text-xs"
                            >
                              <option value="">(nenhum, é texto)</option>
                              <option value="calendario">calendario</option>
                              <option value="relogio">relogio</option>
                              <option value="local">local</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                              QR Code
                            </label>
                            <input
                              type="text"
                              value={b.qr || ''}
                              onChange={(e) => atualizarBloco(idx, { qr: e.target.value })}
                              placeholder="ex.: {mocao_pdf}"
                              className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1.5 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {!b.icone && !b.qr && (
                        <div>
                          <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                            Texto com marcadores
                          </label>
                          <textarea
                            rows={2}
                            value={b.texto}
                            onChange={(e) => atualizarBloco(idx, { texto: e.target.value })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white p-2 text-xs"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <div>
                          <label className="block text-[11px] text-[#5f6b7e]">X (0..1)</label>
                          <input
                            type="number"
                            step="0.005"
                            value={b.x}
                            onChange={(e) => atualizarBloco(idx, { x: Number(e.target.value) })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#5f6b7e]">Y (0..1)</label>
                          <input
                            type="number"
                            step="0.005"
                            value={b.y}
                            onChange={(e) => atualizarBloco(idx, { y: Number(e.target.value) })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#5f6b7e]">Largura</label>
                          <input
                            type="number"
                            step="0.01"
                            value={b.largura}
                            onChange={(e) => atualizarBloco(idx, { largura: Number(e.target.value) })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#5f6b7e]">Tamanho</label>
                          <input
                            type="number"
                            step="0.002"
                            value={b.tamanho}
                            onChange={(e) => atualizarBloco(idx, { tamanho: Number(e.target.value) })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#5f6b7e]">Máx. linhas</label>
                          <input
                            type="number"
                            min={1}
                            value={b.max_linhas}
                            onChange={(e) => atualizarBloco(idx, { max_linhas: Number(e.target.value) })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] text-[#5f6b7e]">Fonte</label>
                          <select
                            value={b.fonte}
                            onChange={(e) => atualizarBloco(idx, { fonte: e.target.value })}
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          >
                            {FONTES_OPCOES.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#5f6b7e]">Alinhamento</label>
                          <select
                            value={b.align}
                            onChange={(e) =>
                              atualizarBloco(idx, { align: e.target.value as 'center' | 'left' | 'right' })
                            }
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          >
                            <option value="center">centro</option>
                            <option value="left">esquerda</option>
                            <option value="right">direita</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#5f6b7e]">Âncora</label>
                          <select
                            value={b.ancora}
                            onChange={(e) =>
                              atualizarBloco(idx, { ancora: e.target.value as 'topo' | 'meio' })
                            }
                            className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1 text-xs"
                          >
                            <option value="topo">a 1ª linha</option>
                            <option value="meio">o meio do bloco</option>
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <div>
                            <label className="block text-[10px] text-[#5f6b7e]">Cor</label>
                            <input
                              type="color"
                              value={b.cor}
                              onChange={(e) => atualizarBloco(idx, { cor: e.target.value })}
                              className="h-7 w-9 cursor-pointer rounded border border-[#dde3ec]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#5f6b7e]">Destaque</label>
                            <input
                              type="color"
                              value={b.cor_destaque}
                              onChange={(e) => atualizarBloco(idx, { cor_destaque: e.target.value })}
                              className="h-7 w-9 cursor-pointer rounded border border-[#dde3ec]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={b.maiusculas}
                              onChange={(e) => atualizarBloco(idx, { maiusculas: e.target.checked })}
                            />
                            Maiúsculas
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={b.encolher}
                              onChange={(e) => atualizarBloco(idx, { encolher: e.target.checked })}
                            />
                            Encolher se passar do limite
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={b.oculto}
                              onChange={(e) => atualizarBloco(idx, { oculto: e.target.checked })}
                            />
                            Ocultar bloco
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBlocos((p) => p.filter((_, i) => i !== idx))}
                          className="text-[#c62828] hover:underline cursor-pointer"
                        >
                          Remover bloco
                        </button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>

              <div className="flex justify-between pt-3 border-t border-[#dde3ec]">
                <button
                  type="button"
                  onClick={adicionarBloco}
                  className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-semibold hover:bg-[#eef1f7] cursor-pointer"
                >
                  + Adicionar bloco
                </button>
                <button
                  type="button"
                  onClick={salvarModelo}
                  disabled={salvando}
                  className="rounded-[10px] bg-[#1f5fe0] px-5 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Salvar modelo'}
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ModelosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f6fa]" />}>
      <ModelosConteudo />
    </Suspense>
  );
}
