'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { calcularDatasConviteGeral, formatarDataCurta } from '@/core/regimento';

interface ContatoItem {
  id?: number;
  nome: string;
  cargo: string;
  email: string;
  grupo: string;
  partido: string;
  obs: string;
  selecionado: boolean;
}

interface SessaoOpcao {
  id: string;
  titulo: string;
  data: string;
  hora: string;
}

const GRUPOS = [
  'Vereadores',
  'Assessoria parlamentar',
  'Servidores e setores',
  'Canais institucionais',
];

function ContatosConteudo() {
  const sp = useSearchParams();
  const sInicial = sp.get('s') || '';

  const [sessoes, setSessoes] = useState<SessaoOpcao[]>([]);
  const [sessaoId, setSessaoId] = useState(sInicial);
  const [jaReceberamCount, setJaReceberamCount] = useState(0);
  const [contatos, setContatos] = useState<ContatoItem[]>([]);
  const [usarBcc, setUsarBcc] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    const [rc, rs] = await Promise.all([fetch('/api/contatos'), fetch('/api/sessoes')]);
    const dc = await rc.json();
    const ds = await rs.json();
    if (dc.ok) setContatos(dc.contatos || []);
    if (ds.ok) {
      const lista = ds.sessoes || [];
      setSessoes(lista);
      if (!sInicial && lista.length > 0) setSessaoId(lista[0].id);
    }
  }, [sInicial]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!sessaoId) return;
    fetch(`/api/sessoes/${sessaoId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.sessao) {
          setJaReceberamCount((d.sessao.conviteGeralEnviados || []).length);
        }
      });
  }, [sessaoId]);

  async function handleEnviarConviteGeral() {
    if (!sessaoId) return;
    const emails = contatos.filter((c) => c.selecionado && c.email.trim()).map((c) => c.email.trim());
    if (emails.length === 0) return;

    setEnviando(true);
    setAviso(null);
    try {
      const r = await fetch('/api/comunicacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'convite_geral',
          sessaoId,
          usarBcc,
          emails,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setJaReceberamCount(d.totalReceberam || emails.length);
        setAviso({
          tipo: 'ok',
          msg: `Convite geral enviado a ${emails.length} contato(s) via ${d.remetenteUsado}!`,
        });
      } else {
        setAviso({ tipo: 'erro', msg: d.error || 'Falha ao enviar convite geral.' });
      }
    } finally {
      setEnviando(false);
    }
  }

  async function handleSalvarLista() {
    setSalvando(true);
    try {
      const r = await fetch('/api/contatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contatos }),
      });
      const d = await r.json();
      if (d.ok) {
        setContatos(d.contatos);
        setAviso({ tipo: 'ok', msg: 'Lista de contatos da Casa salva com sucesso!' });
      }
    } finally {
      setSalvando(false);
    }
  }

  const sessaoAtual = sessoes.find((s) => s.id === sessaoId);
  const datasProg = sessaoAtual ? calcularDatasConviteGeral(sessaoAtual.data) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={sessaoId || undefined} subtitulo="Contatos e Convite Geral" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        {aviso && (
          <div
            className={`rounded-[12px] border px-4 py-3 text-xs font-medium flex justify-between ${
              aviso.tipo === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-[#c62828]'
            }`}
          >
            <span>{aviso.msg}</span>
            <button type="button" onClick={() => setAviso(null)} className="font-bold cursor-pointer">
              ×
            </button>
          </div>
        )}

        {/* Disparo do Convite Geral */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#151a22]">Convite geral da Casa</h1>
              <p className="text-xs text-[#5f6b7e]">
                Disparo institucional com a arte do Convite Geral para vereadores, assessoria e servidores.
              </p>
            </div>
            <select
              value={sessaoId}
              onChange={(e) => setSessaoId(e.target.value)}
              className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-xs font-semibold"
            >
              {sessoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titulo} — {formatarDataCurta(s.data)}
                </option>
              ))}
            </select>
          </div>

          {datasProg && (
            <div className="rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] p-3.5 text-xs text-[#5f6b7e] flex flex-wrap gap-6">
              <div>
                <span className="font-semibold text-[#151a22]">1º disparo automático:</span>{' '}
                {datasProg.sextaAnteriorBr}, sexta que antecede
              </div>
              <div>
                <span className="font-semibold text-[#151a22]">Lembrete (`LEMBRETE:` no assunto):</span>{' '}
                {datasProg.vesperaBr}, véspera da sessão
              </div>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs text-[#151a22] cursor-pointer">
            <input
              type="checkbox"
              checked={usarBcc}
              onChange={(e) => setUsarBcc(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span>
              <strong>Enviar com cópia oculta (BCC)</strong> — ninguém vê a lista de convidados. Desmarcado,
              sai um e-mail só com todos no campo &quot;Para&quot;.
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#dde3ec]">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enviando || !sessaoId}
                onClick={handleEnviarConviteGeral}
                className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] disabled:opacity-60 cursor-pointer"
              >
                {enviando ? 'Enviando...' : 'Enviar convite aos marcados'}
              </button>
              {sessaoId && (
                <a
                  href={`/api/arte?m=convite_geral&s=${sessaoId}&baixar=1`}
                  className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7]"
                >
                  Baixar a arte
                </a>
              )}
              <Link
                href={`/modelos?m=convite_geral${sessaoId ? `&s=${sessaoId}` : ''}`}
                className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7]"
              >
                Ajustar o modelo
              </Link>
            </div>
            <span className="text-xs font-semibold text-[#5f6b7e] tabular-nums">
              {jaReceberamCount} de {contatos.length} já receberam o convite desta sessão
            </span>
          </div>
        </section>

        {/* Lista de Contatos Agrupada */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#151a22]">
                Contatos da Casa ({contatos.length})
              </h2>
              <p className="text-xs text-[#5f6b7e]">
                A caixa da esquerda escolhe quem recebe o convite geral agora; apague o nome e salve caso
                queira remover um contato.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setContatos((p) => p.map((c) => ({ ...c, selecionado: true })))}
                className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1.5 text-xs font-medium hover:bg-[#eef1f7] cursor-pointer"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => setContatos((p) => p.map((c) => ({ ...c, selecionado: false })))}
                className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1.5 text-xs font-medium hover:bg-[#eef1f7] cursor-pointer"
              >
                Desmarcar todos
              </button>
              <button
                type="button"
                onClick={() =>
                  setContatos((p) => [
                    ...p,
                    {
                      nome: '',
                      cargo: '',
                      email: '',
                      grupo: 'Servidores e setores',
                      partido: '',
                      obs: '',
                      selecionado: true,
                    },
                  ])
                }
                className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1.5 text-xs font-medium hover:bg-[#eef1f7] cursor-pointer"
              >
                + Incluir contato
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={handleSalvarLista}
                className="rounded-[8px] bg-[#12904a] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0c7239] cursor-pointer"
              >
                {salvando ? 'Salvando...' : 'Salvar lista'}
              </button>
            </div>
          </div>

          {GRUPOS.map((grupo) => {
            const itensGrupo = contatos
              .map((c, idx) => ({ c, idx }))
              .filter(({ c }) => c.grupo === grupo);
            return (
              <div key={grupo} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#123f6b] border-b border-[#dde3ec] pb-1">
                  {grupo} ({itensGrupo.length})
                </h3>
                <div className="space-y-1.5">
                  {itensGrupo.map(({ c, idx }) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] p-2.5 sm:grid-cols-12 items-center text-xs"
                    >
                      <div className="sm:col-span-4 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={c.selecionado}
                          onChange={(e) =>
                            setContatos((p) =>
                              p.map((x, i) => (i === idx ? { ...x, selecionado: e.target.checked } : x))
                            )
                          }
                          className="h-4 w-4 rounded"
                        />
                        <input
                          type="text"
                          value={c.nome}
                          placeholder="Nome"
                          onChange={(e) =>
                            setContatos((p) =>
                              p.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x))
                            )
                          }
                          className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1 font-medium"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="email"
                          value={c.email}
                          placeholder="email@camaraitapoa.sc.gov.br"
                          onChange={(e) =>
                            setContatos((p) =>
                              p.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x))
                            )
                          }
                          className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1 font-mono text-[11px]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={c.cargo}
                          placeholder="Cargo"
                          onChange={(e) =>
                            setContatos((p) =>
                              p.map((x, i) => (i === idx ? { ...x, cargo: e.target.value } : x))
                            )
                          }
                          className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2 py-1"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-1">
                        <select
                          value={c.grupo}
                          onChange={(e) =>
                            setContatos((p) =>
                              p.map((x, i) => (i === idx ? { ...x, grupo: e.target.value } : x))
                            )
                          }
                          className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-1.5 py-1 text-[11px]"
                        >
                          {GRUPOS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                        {c.obs && (
                          <span
                            title={c.obs}
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 whitespace-nowrap"
                          >
                            LIC.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default function ContatosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f6fa]" />}>
      <ContatosConteudo />
    </Suspense>
  );
}
