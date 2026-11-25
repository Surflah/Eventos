'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { calcularStatusPrazoMidia, formatarDataCurta } from '@/core/regimento';

interface OverrideCert {
  ativo?: boolean;
  artigo?: string;
  nomeCompleto?: string;
  textoConcessao?: string;
}

interface HomEntregavel {
  id: string;
  nome: string;
  qualificacao: string;
  comoChamar: string;
  mocao: string;
  dataAprovacao: string;
  proponente: string;
  tratamentoProponente: string;
  partidoProponente: string;
  emailGabinete: string;
  feito: string;
  fotos: Array<{ arquivo: string; origem?: string }>;
  videoArquivo: string | null;
  uploadToken: string;
  convitePropEnviadoEm: string | null;
  certificadoOverride: OverrideCert;
}

interface SessaoEntregaveis {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  homenageados: HomEntregavel[];
}

export default function EntregaveisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sessao, setSessao] = useState<SessaoEntregaveis | null>(null);
  const [emailsPorHom, setEmailsPorHom] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, OverrideCert>>({});
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const [hashPreview, setHashPreview] = useState(() => Date.now());

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/sessoes/${id}`);
    const d = await r.json();
    if (d.ok && d.sessao) {
      setSessao(d.sessao);
      const mapE: Record<string, string> = {};
      const mapO: Record<string, OverrideCert> = {};
      for (const h of d.sessao.homenageados as HomEntregavel[]) {
        mapE[h.id] = h.emailGabinete || '';
        mapO[h.id] = {
          ativo: Boolean(h.certificadoOverride?.ativo),
          artigo: h.certificadoOverride?.artigo ?? h.comoChamar,
          nomeCompleto: h.certificadoOverride?.nomeCompleto ?? h.nome,
          textoConcessao:
            h.certificadoOverride?.textoConcessao ??
            `Por propositura {do_proponente} **{tratamento_proponente} {proponente}**, e coautoria de demais vereadores, a Moção n. {mocao} aprovada em plenário em {data_aprovacao}, {motivo}.`,
        };
      }
      setEmailsPorHom(mapE);
      setOverrides(mapO);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviarConviteGabinete(h: HomEntregavel) {
    setEnviandoId(h.id);
    setAviso(null);
    try {
      const r = await fetch('/api/comunicacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'convite_proponente',
          sessaoId: id,
          hid: h.id,
          enviarPara: emailsPorHom[h.id] || '',
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setAviso({
          tipo: 'ok',
          msg: `Convite e link de mídias enviados para ${emailsPorHom[h.id]} (remetente: ${d.remetenteUsado}).`,
        });
        await carregar();
      } else {
        setAviso({
          tipo: 'erro',
          msg: d.error || 'Falha ao enviar e-mail.',
        });
      }
    } finally {
      setEnviandoId(null);
    }
  }

  async function salvarOverrideCertificado(h: HomEntregavel) {
    const ov = overrides[h.id];
    await fetch(`/api/sessoes/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'salvar_homenageado',
        hid: h.id,
        certificadoOverride: { ...ov, ativo: true },
      }),
    });
    setHashPreview(Date.now());
    setAviso({ tipo: 'ok', msg: `Certificado personalizado de "${h.nome}" salvo!` });
  }

  async function restaurarPadraoCertificado(h: HomEntregavel) {
    await fetch(`/api/sessoes/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'salvar_homenageado',
        hid: h.id,
        certificadoOverride: { ativo: false },
      }),
    });
    setHashPreview(Date.now());
    await carregar();
  }

  function copiarLinkPortal(token: string) {
    const url = `${window.location.origin}/enviar/${token}`;
    void navigator.clipboard.writeText(url);
    setAviso({ tipo: 'ok', msg: `Link de envio copiado: ${url}` });
  }

  if (!sessao) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar sessaoId={id} />
        <main className="p-8 text-center text-sm text-[#5f6b7e]">Carregando entregáveis...</main>
      </div>
    );
  }

  const comMaterial = sessao.homenageados.filter(
    (h) => h.fotos.length > 0 || Boolean(h.videoArquivo)
  ).length;
  const totalFotos = sessao.homenageados.reduce((s, h) => s + h.fotos.length, 0);
  const totalVideos = sessao.homenageados.filter((h) => Boolean(h.videoArquivo)).length;
  const noDrive = sessao.homenageados.reduce(
    (s, h) => s + h.fotos.filter((f) => f.origem === 'drive').length,
    0
  );
  const prazo = calcularStatusPrazoMidia(sessao.data);

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar sessaoId={id} subtitulo="Convites e Certificados" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#151a22]">Convites e certificados</h1>
            <p className="text-xs text-[#5f6b7e]">
              Sessão de {formatarDataCurta(sessao.data)} · {sessao.homenageados.length} homenageado(s).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/modelos?s=${id}`}
              className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-semibold text-[#151a22] hover:bg-[#eef1f7]"
            >
              Ajustar modelos
            </Link>
            <a
              href={`/api/arte?m=convite&s=${id}&lote=1&f=pdf&baixar=1`}
              className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-semibold text-[#1f5fe0] hover:bg-blue-50"
            >
              PDF de todos os convites
            </a>
            <a
              href={`/api/arte?m=certificado&s=${id}&lote=1&f=pdf&baixar=1`}
              className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#164bb5]"
            >
              PDF de todos os certificados
            </a>
          </div>
        </div>

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

        {/* 4 KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-[14px] border border-[#dde3ec] bg-white p-4 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-[#151a22]">
              {comMaterial} <span className="text-sm font-normal text-[#5f6b7e]">de {sessao.homenageados.length}</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-[#151a22]">homenageados com material</div>
            <div className="text-[11px] text-[#5f6b7e]">
              {comMaterial === sessao.homenageados.length && sessao.homenageados.length > 0
                ? 'todos entregaram'
                : 'aguardando envios'}
            </div>
          </div>

          <div className="rounded-[14px] border border-[#dde3ec] bg-white p-4 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-[#151a22]">{totalFotos}</div>
            <div className="mt-1 text-xs font-semibold text-[#151a22]">foto(s) recebida(s)</div>
            <div className="text-[11px] text-[#5f6b7e]">passam no telão durante a leitura</div>
          </div>

          <div className="rounded-[14px] border border-[#dde3ec] bg-white p-4 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-[#151a22]">{totalVideos}</div>
            <div className="mt-1 text-xs font-semibold text-[#151a22]">vídeo(s) anexado(s)</div>
            <div className="text-[11px] text-[#5f6b7e]">
              {noDrive} do Drive, {totalVideos} no servidor
            </div>
          </div>

          <div className="rounded-[14px] border border-[#dde3ec] bg-white p-4 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-[#151a22]">
              {prazo.diasRestantes} <span className="text-sm font-normal text-[#5f6b7e]">dia(s)</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-[#151a22]">até o prazo de envio</div>
            <div className="text-[11px] text-[#5f6b7e]">
              fecha {prazo.ddMmVespera}, véspera da sessão
            </div>
          </div>
        </div>

        {/* Convite ao vereador proponente */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#151a22]">Convite ao vereador proponente</h2>
            <p className="text-xs text-[#5f6b7e]">
              Envia um e-mail ao gabinete com o <strong>convite do homenageado em anexo</strong> e o{' '}
              <strong>link exclusivo para envio das fotos e vídeo</strong>. O certificado não vai neste e-mail.
            </p>
          </div>

          <div className="space-y-3">
            {sessao.homenageados.map((h) => (
              <div
                key={h.id}
                className="rounded-[12px] border border-[#dde3ec] bg-[#f8fafc] p-4 flex flex-wrap items-end justify-between gap-3"
              >
                <div className="flex-1 min-w-[260px] space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#151a22]">
                      {h.tratamentoProponente} {h.proponente || 'Sem proponente'}
                    </span>
                    <span className="text-xs text-[#5f6b7e]">
                      · Moção {h.mocao || '—'} · {h.nome}
                    </span>
                    {h.convitePropEnviadoEm && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        E-mail enviado ✓
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                      Enviar para (separe por vírgula)
                    </label>
                    <input
                      type="text"
                      value={emailsPorHom[h.id] || ''}
                      onChange={(e) => setEmailsPorHom((p) => ({ ...p, [h.id]: e.target.value }))}
                      placeholder="gabinete@camaraitapoa.sc.gov.br"
                      className="w-full max-w-lg rounded-[8px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copiarLinkPortal(h.uploadToken)}
                    className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7] cursor-pointer"
                  >
                    Copiar link de envio
                  </button>
                  <button
                    type="button"
                    disabled={enviandoId === h.id}
                    onClick={() => enviarConviteGabinete(h)}
                    className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] disabled:opacity-60 cursor-pointer"
                  >
                    {enviandoId === h.id ? 'Enviando...' : 'Enviar convite e link'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Previews individuais e override de certificado */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-[#151a22]">Artes por homenageado</h2>
          {sessao.homenageados.map((h) => {
            const ov = overrides[h.id] || {};
            return (
              <div
                key={h.id}
                className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#151a22]">{h.nome}</h3>
                    <p className="text-xs text-[#5f6b7e]">
                      Moção {h.mocao || '—'} · {h.tratamentoProponente} {h.proponente}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {/* Convite */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#151a22]">Convite individual</span>
                      <div className="flex gap-2">
                        <a
                          href={`/api/arte?m=convite&s=${id}&h=${h.id}&baixar=1`}
                          className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs font-medium hover:bg-[#eef1f7]"
                        >
                          PNG
                        </a>
                        <a
                          href={`/api/arte?m=convite&s=${id}&h=${h.id}&f=pdf&baixar=1`}
                          className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs font-medium text-[#1f5fe0] hover:bg-blue-50"
                        >
                          PDF
                        </a>
                      </div>
                    </div>
                    <img
                      src={`/api/arte?m=convite&s=${id}&h=${h.id}&w=560&v=${hashPreview}`}
                      alt={`Convite de ${h.nome}`}
                      className="w-full rounded-[10px] border border-[#dde3ec] bg-[#faf7f0]"
                    />
                  </div>

                  {/* Certificado */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#151a22]">
                        Certificado da moção{' '}
                        {h.certificadoOverride?.ativo && (
                          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
                            Texto personalizado
                          </span>
                        )}
                      </span>
                      <div className="flex gap-2">
                        <a
                          href={`/api/arte?m=certificado&s=${id}&h=${h.id}&baixar=1`}
                          className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs font-medium hover:bg-[#eef1f7]"
                        >
                          PNG
                        </a>
                        <a
                          href={`/api/arte?m=certificado&s=${id}&h=${h.id}&f=pdf&baixar=1`}
                          className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs font-medium text-[#1f5fe0] hover:bg-blue-50"
                        >
                          PDF
                        </a>
                      </div>
                    </div>
                    <img
                      src={`/api/arte?m=certificado&s=${id}&h=${h.id}&w=560&v=${hashPreview}`}
                      alt={`Certificado de ${h.nome}`}
                      className="w-full rounded-[10px] border border-[#dde3ec] bg-[#faf7f0]"
                    />
                  </div>
                </div>

                {/* Override pontual deste certificado */}
                <details className="rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] p-4">
                  <summary className="cursor-pointer text-xs font-bold text-[#151a22]">
                    Ajustar texto só deste certificado
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                        Conectivo antes do nome ({'{artigo}'})
                      </label>
                      <input
                        type="text"
                        value={ov.artigo ?? ''}
                        onChange={(e) =>
                          setOverrides((p) => ({ ...p, [h.id]: { ...ov, artigo: e.target.value } }))
                        }
                        className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                        Nome no certificado ({'{nome_completo}'})
                      </label>
                      <input
                        type="text"
                        value={ov.nomeCompleto ?? ''}
                        onChange={(e) =>
                          setOverrides((p) => ({
                            ...p,
                            [h.id]: { ...ov, nomeCompleto: e.target.value },
                          }))
                        }
                        className="w-full rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-[#5f6b7e] mb-1">
                        Texto da concessão (suporta **negrito** e marcadores)
                      </label>
                      <textarea
                        rows={3}
                        value={ov.textoConcessao ?? ''}
                        onChange={(e) =>
                          setOverrides((p) => ({
                            ...p,
                            [h.id]: { ...ov, textoConcessao: e.target.value },
                          }))
                        }
                        className="w-full rounded-[8px] border border-[#dde3ec] bg-white p-2.5 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3 flex justify-end gap-2">
                      {h.certificadoOverride?.ativo && (
                        <button
                          type="button"
                          onClick={() => restaurarPadraoCertificado(h)}
                          className="rounded-[8px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-medium cursor-pointer"
                        >
                          Voltar ao modelo geral
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => salvarOverrideCertificado(h)}
                        className="rounded-[8px] bg-[#1f5fe0] px-4 py-1.5 text-xs font-semibold text-white cursor-pointer"
                      >
                        Salvar este certificado
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
