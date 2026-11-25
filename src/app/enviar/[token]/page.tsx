'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { enviarArquivoComSuporteChunk } from '@/lib/chunked-upload';

interface DadosPortal {
  sessaoTitulo: string;
  sessaoData: string;
  sessaoHora: string;
  homenageadoNome: string;
  mocao: string;
  proponente: string;
  vaiFalar: string;
  representanteNome: string;
  representanteCargo: string;
  fotos: Array<{ arquivo: string; nomeOriginal: string }>;
  temVideo: boolean;
  videoArquivo: string | null;
  prazo: {
    encerrado: boolean;
    horasRestantes: number;
    ddMmVespera: string;
  };
}

export default function PortalPublicoEnviarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [dados, setDados] = useState<DadosPortal | null>(null);
  const [invalido, setInvalido] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  const [vaiFalar, setVaiFalar] = useState('indefinido');
  const [repNome, setRepNome] = useState('');
  const [repCargo, setRepCargo] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/public/enviar/${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setInvalido(true);
      } else {
        setDados(d.dados);
        setVaiFalar(d.dados.vaiFalar || 'indefinido');
        setRepNome(d.dados.representanteNome || '');
        setRepCargo(d.dados.representanteCargo || '');
      }
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleEnviarMidias(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAviso(null);
    setProgresso(5);
    const arr = Array.from(files);

    for (let i = 0; i < arr.length; i++) {
      const res = await enviarArquivoComSuporteChunk({
        endpoint: `/api/public/enviar/${encodeURIComponent(token)}`,
        file: arr[i],
        onProgress: (pct) => {
          setProgresso(Math.round(((i + pct / 100) / arr.length) * 100));
        },
      });
      if (!res.ok) {
        setAviso({ tipo: 'erro', msg: res.error || 'Erro ao enviar arquivo.' });
        setProgresso(null);
        return;
      }
    }

    setProgresso(null);
    setAviso({ tipo: 'ok', msg: 'Arquivos recebidos com sucesso! Muito obrigado.' });
    await carregar();
  }

  async function handleSalvarPronunciamento() {
    const r = await fetch(`/api/public/enviar/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vaiFalar,
        representanteNome: repNome,
        representanteCargo: repCargo,
      }),
    });
    const d = await r.json();
    if (d.ok) {
      setAviso({ tipo: 'ok', msg: 'Confirmação de uso da palavra registrada!' });
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] p-6 text-sm text-[#5f6b7e]">
        Carregando portal da homenagem...
      </div>
    );
  }

  if (invalido || !dados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] p-4">
        <div className="max-w-md rounded-2xl border border-[#dde3ec] bg-white p-7 text-center shadow-lg">
          <img
            src="/img/logo-transparente.png"
            alt="Câmara Municipal de Itapoá"
            className="mx-auto h-14 w-auto mb-3"
          />
          <h1 className="text-lg font-bold text-[#151a22]">Link inválido</h1>
          <p className="mt-2 text-xs leading-relaxed text-[#5f6b7e]">
            Este endereço não corresponde a nenhuma homenagem. Confira se o link foi copiado inteiro do
            e-mail — ele é longo e às vezes quebra em duas linhas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fa] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-2xl border border-[#dde3ec] bg-white p-6 shadow-xs text-center">
          <img
            src="/img/logo-transparente.png"
            alt="Câmara Municipal de Itapoá"
            className="mx-auto h-14 w-auto mb-3"
          />
          <span className="inline-block rounded-full bg-blue-50 px-3 py-0.5 text-[11px] font-bold text-[#1f5fe0]">
            {dados.sessaoTitulo} · {dados.sessaoData} às {dados.sessaoHora}
          </span>
          <h1 className="mt-2 text-xl font-bold text-[#151a22]">{dados.homenageadoNome}</h1>
          <p className="mt-1 text-xs text-[#5f6b7e]">
            {dados.mocao ? `Moção nº ${dados.mocao} · ` : ''}Proposição: {dados.proponente}
          </p>
        </header>

        {aviso && (
          <div
            className={`rounded-xl border p-4 text-xs font-medium ${
              aviso.tipo === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-[#c62828]'
            }`}
          >
            {aviso.msg}
          </div>
        )}

        {dados.prazo.encerrado ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center space-y-2">
            <h2 className="text-base font-bold text-amber-950">Prazo de envio encerrado</h2>
            <p className="text-xs text-amber-900">
              O recebimento de materiais fechou na véspera da sessão ({dados.prazo.ddMmVespera} às 23h59)
              para preparo do telão pela equipe técnica. Caso precise incluir material urgente, contate o
              gabinete proponente ou o Setor de Eventos.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#151a22]">1. Enviar fotos e vídeo</h2>
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                  Prazo: {dados.prazo.ddMmVespera} às 23:59
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#5f6b7e]">
                Envie de <strong>10 a 20 fotos</strong> que passarão no telão durante a leitura da moção e,
                se desejar, <strong>1 vídeo curto</strong> (aceita vídeos grandes em alta resolução direto
                do celular ou computador).
              </p>

              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#1f5fe0]/40 bg-blue-50/40 p-7 text-center hover:bg-blue-50 transition-colors cursor-pointer">
                <span className="text-sm font-bold text-[#1f5fe0]">
                  Toque aqui para escolher fotos ou vídeo
                </span>
                <span className="mt-1 text-xs text-[#5f6b7e]">
                  Formatos aceitos: JPG, PNG, WebP, MP4, MOV
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => handleEnviarMidias(e.target.files)}
                  className="hidden"
                />
              </label>

              {progresso !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#1f5fe0]">
                    <span>Enviando arquivos (não feche esta página)...</span>
                    <span>{progresso}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full bg-[#1f5fe0] transition-all"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>
              )}

              {(dados.fotos.length > 0 || dados.temVideo) && (
                <div className="pt-2 space-y-2">
                  <div className="text-xs font-semibold text-[#151a22]">
                    Já recebidos: {dados.fotos.length} foto(s)
                    {dados.temVideo ? ' e 1 vídeo ✓' : ''}
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {dados.fotos.map((f) => (
                      <img
                        key={f.arquivo}
                        src={f.arquivo}
                        alt={f.nomeOriginal}
                        className="aspect-square w-full rounded-lg object-cover border border-[#dde3ec]"
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#151a22]">2. Uso da palavra na solenidade</h2>
              <div className="flex flex-wrap gap-2.5 text-xs">
                {[
                  ['sim', 'Sim, vai falar'],
                  ['nao', 'Não vai falar'],
                  ['indefinido', 'Ainda não sei'],
                ].map(([v, rot]) => (
                  <label
                    key={v}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 cursor-pointer ${
                      vaiFalar === v
                        ? 'border-[#1f5fe0] bg-blue-50 font-semibold text-[#1f5fe0]'
                        : 'border-[#dde3ec] bg-[#f8fafc]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="falar"
                      checked={vaiFalar === v}
                      onChange={() => setVaiFalar(v)}
                    />
                    {rot}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Quem recebe e fala (se for grupo/entidade)
                  </label>
                  <input
                    type="text"
                    value={repNome}
                    onChange={(e) => setRepNome(e.target.value)}
                    placeholder="Nome completo do representante"
                    className="w-full rounded-xl border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Cargo ou função
                  </label>
                  <input
                    type="text"
                    value={repCargo}
                    onChange={(e) => setRepCargo(e.target.value)}
                    placeholder="Ex.: Presidente da Associação"
                    className="w-full rounded-xl border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSalvarPronunciamento}
                className="w-full rounded-xl bg-[#12904a] py-2.5 text-xs font-semibold text-white hover:bg-[#0c7239] cursor-pointer"
              >
                Confirmar informações de pronunciamento
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
