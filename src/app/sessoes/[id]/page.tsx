'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { enviarArquivoComSuporteChunk } from '@/lib/chunked-upload';
import { formatarDataCurta, VereadorSessaoItem } from '@/core/regimento';

interface FotoMidia {
  arquivo: string;
  nomeOriginal: string;
  origem?: string;
}

interface HomenageadoItem {
  id: string;
  ordem: number;
  mocao: string;
  dataAprovacao: string;
  nome: string;
  qualificacao: string;
  comoChamar: string;
  proponente: string;
  tratamentoProponente: string;
  partidoProponente: string;
  emailGabinete: string;
  obs: string;
  feito: string;
  textoCerimonial: string;
  textoMocao: string;
  modoVideo: string;
  videoArquivo: string | null;
  fotos: FotoMidia[];
  uploadToken: string;
}

interface SessaoCompleta {
  id: string;
  titulo: string;
  numero: string;
  local: string;
  data: string;
  hora: string;
  presidente: string;
  driveUrl: string;
  vereadores: VereadorSessaoItem[];
  autoridades: string;
  abertura: string;
  encerramento: string;
  presencaMudouAposAbertura: boolean;
  totalContatos: number;
  checklist: Record<string, boolean>;
  homenageados: HomenageadoItem[];
}

const OPCOES_COMO_CHAMAR = ['ao', 'à', 'ao senhor', 'à senhora', 'aos', 'às'];

export default function SessaoMontagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sessao, setSessao] = useState<SessaoCompleta | null>(null);
  const [autoSave, setAutoSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const [progressoUpload, setProgressoUpload] = useState<Record<string, number>>({});
  const [modalNovoManual, setModalNovoManual] = useState(false);
  const [nomeNovoManual, setNomeNovoManual] = useState('');
  const [alvoRemover, setAlvoRemover] = useState<HomenageadoItem | null>(null);

  const timerSessaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timersHomRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/sessoes/${id}`);
    const d = await r.json();
    if (d.ok) setSessao(d.sessao);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function postAcao(payload: Record<string, unknown>) {
    setAutoSave('saving');
    try {
      const r = await fetch(`/api/sessoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.ok && d.sessao) {
        setSessao(d.sessao);
        setAutoSave('saved');
      } else {
        setAutoSave('error');
      }
      return d;
    } catch {
      setAutoSave('error');
      return { ok: false };
    }
  }

  function agendarAutoSaveSessao(parcial: Partial<SessaoCompleta>) {
    if (!sessao) return;
    const atualizado = { ...sessao, ...parcial };
    setSessao(atualizado);
    if (timerSessaoRef.current) clearTimeout(timerSessaoRef.current);
    timerSessaoRef.current = setTimeout(() => {
      void postAcao({
        acao: 'salvar_sessao',
        titulo: atualizado.titulo,
        numero: atualizado.numero,
        local: atualizado.local,
        data: atualizado.data,
        hora: atualizado.hora,
        presidente: atualizado.presidente,
        driveUrl: atualizado.driveUrl,
        vereadores: atualizado.vereadores,
        autoridades: atualizado.autoridades,
        abertura: atualizado.abertura,
        encerramento: atualizado.encerramento,
      });
    }, 650);
  }

  function agendarAutoSaveHomenageado(hid: string, parcial: Partial<HomenageadoItem>) {
    if (!sessao) return;
    const novos = sessao.homenageados.map((h) => (h.id === hid ? { ...h, ...parcial } : h));
    setSessao({ ...sessao, homenageados: novos });
    const alvo = novos.find((h) => h.id === hid);
    if (!alvo) return;

    if (timersHomRef.current[hid]) clearTimeout(timersHomRef.current[hid]);
    timersHomRef.current[hid] = setTimeout(() => {
      void postAcao({
        acao: 'salvar_homenageado',
        hid,
        ...alvo,
      });
    }, 650);
  }

  async function toggleChecklist(chave: string, valor: boolean) {
    await postAcao({
      acao: 'salvar_sessao',
      checklist: { [chave]: valor },
    });
  }

  async function handleUploadArquivos(hid: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setProgressoUpload((p) => ({ ...p, [hid]: 5 }));

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      await enviarArquivoComSuporteChunk({
        endpoint: '/api/upload',
        file: f,
        camposExtras: { sessaoId: id, hid },
        onProgress: (pct) => {
          const globalPct = Math.round(((i + pct / 100) / files.length) * 100);
          setProgressoUpload((p) => ({ ...p, [hid]: globalPct }));
        },
      });
    }

    setProgressoUpload((p) => {
      const clone = { ...p };
      delete clone[hid];
      return clone;
    });
    await carregar();
  }

  async function handleAdicionarManual() {
    if (!nomeNovoManual.trim()) return;
    await postAcao({ acao: 'adicionar_homenageado', nome: nomeNovoManual.trim() });
    setNomeNovoManual('');
    setModalNovoManual(false);
  }

  if (!sessao) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar sessaoId={id} />
        <main className="mx-auto max-w-6xl p-8 text-center text-sm text-[#5f6b7e]">
          Carregando sessão...
        </main>
      </div>
    );
  }

  const ck = sessao.checklist;
  const concluidosCount = Object.values(ck).filter(Boolean).length;
  const presentesCount = sessao.vereadores.filter((v) => v.presente).length;

  const itensAntes = [
    { key: 'sapl', auto: true, label: 'Importar moções aprovadas da fila do SAPL', link: `/importar?s=${id}`, cta: 'Fila SAPL' },
    { key: 'agenda', auto: false, label: 'Reservar data na Google Agenda da Casa', link: 'https://calendar.google.com/calendar/u/0/r/eventedit', cta: 'Google Agenda', ext: true },
    { key: 'convite_prop', auto: false, label: 'Enviar convite e link de mídias aos gabinetes proponentes', link: `/sessoes/${id}/entregaveis`, cta: 'Entregáveis' },
    { key: 'convite_casa', auto: false, label: `Disparar convite geral da sessão (${sessao.totalContatos} contatos)`, link: `/contatos?s=${id}`, cta: 'Contatos' },
    { key: 'textos', auto: true, label: 'Gerar e revisar textos base do cerimonial', link: `/sessoes/${id}/textos-cerimonial`, cta: 'Textos' },
    { key: 'midias_ok', auto: false, label: 'Conferir fotos e vídeos recebidos até a véspera', link: `/sessoes/${id}/midias`, cta: 'Mídias' },
    { key: 'pronunciamentos', auto: false, label: 'Confirmar quem usa a palavra e representantes', link: `/sessoes/${id}/pronunciamentos`, cta: 'Pronunciamentos' },
  ];

  const itensDia = [
    { key: 'certificados', auto: false, label: 'Baixar e imprimir PDF em lote dos certificados', link: `/sessoes/${id}/entregaveis`, cta: 'Certificados' },
    { key: 'tablet', auto: false, label: 'Atualizar as 3 falas no Tablet do Presidente (PautaOnline)', link: `/sessoes/${id}/tablet`, cta: 'Tablet Presidente' },
    { key: 'presenca', auto: false, label: 'Confirmar vereadores e autoridades presentes na noite', link: `/sessoes/${id}/presenca`, cta: 'Presença' },
    { key: 'textos_dia', auto: false, label: 'Conferir abertura atualizada e imprimir/abrir cerimonial no tablet', link: `/sessoes/${id}/documento`, cta: 'Cerimonial' },
    { key: 'midias', auto: false, label: 'Testar telão 16:9, vídeos locais e trilha sonora na TI', link: `/sessoes/${id}/controle`, cta: 'Operação de TI' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar
        sessaoId={id}
        subtitulo={`${formatarDataCurta(sessao.data)} · ${sessao.homenageados.length} homenageado(s)`}
        autoSaveStatus={autoSave}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        {feedback && (
          <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 flex justify-between items-center">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback('')} className="font-bold cursor-pointer">
              ×
            </button>
          </div>
        )}

        {/* 1. Checklist de Preparação (12 itens) */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-lg font-bold text-[#151a22]">Preparação da sessão</h1>
              <p className="text-xs text-[#5f6b7e]">
                Roteiro operacional completo do Setor de Eventos até o encerramento em plenário.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#eef1f7] px-3 py-1 text-xs font-bold tabular-nums text-[#151a22]">
                {concluidosCount} de 12 concluídos
              </span>
              <Link
                href={`/sessoes/${id}/controle`}
                className="rounded-[10px] bg-[#123f6b] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1e5a99]"
              >
                Abrir Operação de TI
              </Link>
            </div>
          </div>

          <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-[#eef1f7]">
            <div
              className="h-full bg-[#12904a] transition-all duration-300"
              style={{ width: `${Math.round((concluidosCount / 12) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#5f6b7e] mb-2.5">
                Antes da sessão (7)
              </h2>
              <div className="space-y-2">
                {itensAntes.map((it) => (
                  <div
                    key={it.key}
                    className="flex items-center justify-between gap-2 rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] px-3 py-2 text-xs"
                  >
                    <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(ck[it.key])}
                        disabled={it.auto}
                        onChange={(e) => toggleChecklist(it.key, e.target.checked)}
                        className="h-4 w-4 rounded border-[#dde3ec]"
                      />
                      <span className={ck[it.key] ? 'line-through text-[#5f6b7e]' : 'font-medium text-[#151a22]'}>
                        {it.label}
                      </span>
                    </label>
                    {it.ext ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1 font-medium text-[#1f5fe0] hover:bg-blue-50 whitespace-nowrap"
                      >
                        {it.cta} ↗
                      </a>
                    ) : (
                      <Link
                        href={it.link}
                        className="rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1 font-medium text-[#1f5fe0] hover:bg-blue-50 whitespace-nowrap"
                      >
                        {it.cta}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#5f6b7e] mb-2.5">
                No dia da sessão (5)
              </h2>
              <div className="space-y-2">
                {itensDia.map((it) => (
                  <div
                    key={it.key}
                    className="flex items-center justify-between gap-2 rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] px-3 py-2 text-xs"
                  >
                    <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(ck[it.key])}
                        onChange={(e) => toggleChecklist(it.key, e.target.checked)}
                        className="h-4 w-4 rounded border-[#dde3ec]"
                      />
                      <span className={ck[it.key] ? 'line-through text-[#5f6b7e]' : 'font-medium text-[#151a22]'}>
                        {it.label}
                      </span>
                    </label>
                    <Link
                      href={it.link}
                      className="rounded-[8px] border border-[#dde3ec] bg-white px-2.5 py-1 font-medium text-[#1f5fe0] hover:bg-blue-50 whitespace-nowrap"
                    >
                      {it.cta}
                    </Link>
                  </div>
                ))}
                {sessao.presencaMudouAposAbertura && (
                  <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center justify-between gap-2">
                    <span>A presença mudou depois que a abertura foi gerada.</span>
                    <button
                      type="button"
                      onClick={() => postAcao({ acao: 'atualizar_abertura' })}
                      className="rounded-[8px] bg-amber-700 px-2.5 py-1 font-semibold text-white hover:bg-amber-800 cursor-pointer whitespace-nowrap"
                    >
                      Atualizar abertura
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Dados da Sessão */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
          <h2 className="text-base font-bold text-[#151a22] mb-4">Dados da sessão</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">Título</label>
              <input
                type="text"
                value={sessao.titulo}
                onChange={(e) => agendarAutoSaveSessao({ titulo: e.target.value })}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#151a22] mb-1">Número / edição</label>
              <input
                type="text"
                value={sessao.numero}
                onChange={(e) => agendarAutoSaveSessao({ numero: e.target.value })}
                placeholder="ex.: 8ª"
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#151a22] mb-1">Data</label>
                <input
                  type="date"
                  value={sessao.data}
                  onChange={(e) => agendarAutoSaveSessao({ data: e.target.value })}
                  className="w-full rounded-[10px] border border-[#dde3ec] px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#151a22] mb-1">Hora</label>
                <input
                  type="time"
                  value={sessao.hora}
                  onChange={(e) => agendarAutoSaveSessao({ hora: e.target.value })}
                  className="w-full rounded-[10px] border border-[#dde3ec] px-2.5 py-2 text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">Local</label>
              <input
                type="text"
                value={sessao.local}
                onChange={(e) => agendarAutoSaveSessao({ local: e.target.value })}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">Quem preside</label>
              <select
                value={sessao.presidente}
                onChange={(e) => agendarAutoSaveSessao({ presidente: e.target.value })}
                className="w-full rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-sm"
              >
                <option value="">— escolher —</option>
                {sessao.vereadores.map((v) => {
                  const val = `${v.tratamento} ${v.nome}${v.partido ? ` (${v.partido})` : ''}`;
                  return (
                    <option key={v.nome} value={val}>
                      {val}
                      {v.cargo ? ` · ${v.cargo}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">
                Pasta pública do Google Drive (opcional)
              </label>
              <input
                type="url"
                value={sessao.driveUrl}
                onChange={(e) => agendarAutoSaveSessao({ driveUrl: e.target.value })}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  const r = await postAcao({ acao: 'sincronizar_drive' });
                  setFeedback(
                    r.ok
                      ? `Drive lido: ${r.fotosBaixadas || 0} foto(s), ${r.videosBaixados || 0} vídeo(s).`
                      : r.erro || 'Erro ao ler pasta do Drive.'
                  );
                }}
                className="w-full rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#151a22] hover:bg-[#eef1f7] cursor-pointer"
              >
                Ler pasta do Drive
              </button>
            </div>
          </div>
        </section>

        {/* 3. Vereadores presentes e autoridades */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#151a22]">Vereadores presentes e autoridades</h2>
              <p className="text-xs text-[#5f6b7e]">
                Só quem estiver marcado entra na formação da mesa e na chamada final de pronunciamentos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  agendarAutoSaveSessao({
                    vereadores: sessao.vereadores.map((v) => ({ ...v, presente: true })),
                  })
                }
                className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs font-medium hover:bg-[#eef1f7] cursor-pointer"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() =>
                  agendarAutoSaveSessao({
                    vereadores: sessao.vereadores.map((v) => ({ ...v, presente: false })),
                  })
                }
                className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs font-medium hover:bg-[#eef1f7] cursor-pointer"
              >
                Desmarcar todos
              </button>
              <span className="text-xs font-semibold text-[#5f6b7e] tabular-nums">
                {presentesCount} de {sessao.vereadores.length} presentes
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sessao.vereadores.map((v, idx) => (
              <label
                key={v.nome}
                className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2 text-xs cursor-pointer transition-colors ${
                  v.presente
                    ? 'border-emerald-300 bg-emerald-50/50 text-[#151a22]'
                    : 'border-[#dde3ec] bg-[#f8fafc] text-[#5f6b7e]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={v.presente}
                  onChange={(e) => {
                    const novos = [...sessao.vereadores];
                    novos[idx] = { ...v, presente: e.target.checked };
                    agendarAutoSaveSessao({ vereadores: novos });
                  }}
                  className="h-4 w-4 rounded"
                />
                <div>
                  <div className="font-semibold">{v.nome}</div>
                  <div className="text-[11px] text-[#5f6b7e]">
                    {v.partido}
                    {v.cargo ? ` · ${v.cargo}` : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#151a22] mb-1">
              Autoridades presentes (uma por linha)
            </label>
            <textarea
              rows={3}
              value={sessao.autoridades}
              onChange={(e) => agendarAutoSaveSessao({ autoridades: e.target.value })}
              placeholder="Ex.: Prefeito Municipal Jeferson Rubens Garcia..."
              className="w-full rounded-[10px] border border-[#dde3ec] p-3 text-xs"
            />
          </div>
        </section>

        {/* 4. Barra de Textos do Cerimonial e Casos Manuais */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#151a22]">Textos do cerimonial e homenageados</h2>
              <p className="text-xs text-[#5f6b7e]">
                Gere automaticamente os textos que faltam sem apagar o que você já editou manualmente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await postAcao({ acao: 'gerar_textos_faltantes' });
                  setFeedback('Textos faltantes do cerimonial gerados!');
                }}
                className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
              >
                Gerar textos que faltam
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
                Leitor do Tablet
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await postAcao({ acao: 'regerar_todos_textos' });
                  setFeedback('Todos os textos foram regerados com os dados atuais!');
                }}
                className="rounded-[10px] border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                Regerar todos os textos
              </button>
            </div>
          </div>

          <details className="rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] p-4">
            <summary className="cursor-pointer text-xs font-bold text-[#151a22]">
              Mídia e casos manuais (SAPL avulso / Art. 125-A, §5º)
            </summary>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setModalNovoManual(true)}
                className="rounded-[10px] bg-[#12904a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0c7239] cursor-pointer"
              >
                + Adicionar homenageado manualmente
              </button>
              <Link
                href={`/importar?s=${id}`}
                className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7]"
              >
                + Importar mais moções do SAPL
              </Link>
              <button
                type="button"
                onClick={async () => {
                  const r = await postAcao({ acao: 'varrer_videos_disco' });
                  setFeedback(`Varredura concluída: ${r.encontrados || 0} novo(s) vídeo(s) vinculado(s).`);
                }}
                className="rounded-[10px] border border-[#dde3ec] bg-white px-3.5 py-2 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7] cursor-pointer"
              >
                Procurar vídeos que subi pelo painel
              </button>
            </div>
          </details>
        </section>

        {/* 5. Cards de Homenageados (1..N) */}
        <div className="space-y-5">
          {sessao.homenageados.map((h, idx) => (
            <section
              key={h.id}
              className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dde3ec] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#123f6b] text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <h3 className="text-base font-bold text-[#151a22]">{h.nome}</h3>
                  {h.mocao && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#1f5fe0]">
                      Moção {h.mocao}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => postAcao({ acao: 'reordenar_homenageado', hid: h.id, direcao: 'up' })}
                    className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs disabled:opacity-40 hover:bg-[#eef1f7] cursor-pointer"
                    title="Subir posição"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === sessao.homenageados.length - 1}
                    onClick={() => postAcao({ acao: 'reordenar_homenageado', hid: h.id, direcao: 'down' })}
                    className="rounded-[8px] border border-[#dde3ec] px-2.5 py-1 text-xs disabled:opacity-40 hover:bg-[#eef1f7] cursor-pointer"
                    title="Descer posição"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlvoRemover(h)}
                    className="rounded-[8px] border border-red-200 px-2.5 py-1 text-xs font-medium text-[#c62828] hover:bg-red-50 cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">Nome</label>
                  <input
                    type="text"
                    value={h.nome}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { nome: e.target.value })}
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Qualificação (entra depois do nome)
                  </label>
                  <input
                    type="text"
                    value={h.qualificacao}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { qualificacao: e.target.value })}
                    placeholder="ex.: 1º Tenente Bombeiro Militar"
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">Como chamar</label>
                  <select
                    value={h.comoChamar}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { comoChamar: e.target.value })}
                    className="w-full rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-xs"
                  >
                    {OPCOES_COMO_CHAMAR.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">Moção nº</label>
                  <input
                    type="text"
                    value={h.mocao}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { mocao: e.target.value })}
                    placeholder="ex.: 12/2026"
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">Proponente</label>
                  <input
                    type="text"
                    value={h.proponente}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { proponente: e.target.value })}
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#151a22] mb-1">Tratamento</label>
                    <select
                      value={h.tratamentoProponente}
                      onChange={(e) =>
                        agendarAutoSaveHomenageado(h.id, { tratamentoProponente: e.target.value })
                      }
                      className="w-full rounded-[10px] border border-[#dde3ec] bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="Vereador">Vereador</option>
                      <option value="Vereadora">Vereadora</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#151a22] mb-1">Partido</label>
                    <input
                      type="text"
                      value={h.partidoProponente}
                      onChange={(e) =>
                        agendarAutoSaveHomenageado(h.id, { partidoProponente: e.target.value })
                      }
                      className="w-full rounded-[10px] border border-[#dde3ec] px-2.5 py-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Observações da operação
                  </label>
                  <input
                    type="text"
                    value={h.obs}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { obs: e.target.value })}
                    placeholder="ex.: entra com o neto"
                    className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    O que essa pessoa fez (matéria-prima do certificado/resumo)
                  </label>
                  <textarea
                    rows={4}
                    value={h.feito}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { feito: e.target.value })}
                    className="w-full rounded-[10px] border border-[#dde3ec] p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Texto da moção (extraído do PDF oficial)
                  </label>
                  <textarea
                    rows={4}
                    value={h.textoMocao}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { textoMocao: e.target.value })}
                    className="w-full rounded-[10px] border border-[#dde3ec] p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#151a22] mb-1">
                    Texto do cerimonial (bloco completo lido em plenário)
                  </label>
                  <textarea
                    rows={4}
                    value={h.textoCerimonial}
                    onChange={(e) => agendarAutoSaveHomenageado(h.id, { textoCerimonial: e.target.value })}
                    className="w-full rounded-[10px] border border-[#dde3ec] p-2.5 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Mídias do Homenageado */}
              <div className="rounded-[12px] border border-[#dde3ec] bg-[#f8fafc] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#151a22]">
                    Fotos ({h.fotos.length}) e Vídeo {h.videoArquivo ? '(1 anexado)' : '(sem vídeo)'}
                  </span>
                  <label className="inline-flex items-center gap-2 rounded-[10px] bg-white border border-[#dde3ec] px-3 py-1.5 text-xs font-semibold text-[#1f5fe0] hover:bg-blue-50 cursor-pointer">
                    <span>Enviar fotos, vídeo ou PDF da moção</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,application/pdf"
                      onChange={(e) => handleUploadArquivos(h.id, e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>

                <p className="text-[11px] text-[#5f6b7e]">
                  Aceita fotos, vídeos grandes em alta definição (upload automático em fatias sem travar no Cloudflare) e o <strong>PDF da moção</strong> (o texto é extraído na hora).
                </p>

                {progressoUpload[h.id] !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-[#1f5fe0]">
                      <span>Enviando arquivos...</span>
                      <span>{progressoUpload[h.id]}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-blue-100 overflow-hidden">
                      <div
                        className="h-full bg-[#1f5fe0] transition-all"
                        style={{ width: `${progressoUpload[h.id]}%` }}
                      />
                    </div>
                  </div>
                )}

                {h.fotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {h.fotos.map((f) => (
                      <div
                        key={f.arquivo}
                        className="group relative aspect-square overflow-hidden rounded-[8px] border border-[#dde3ec] bg-white"
                      >
                        <img
                          src={f.arquivo}
                          alt={f.nomeOriginal}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            postAcao({ acao: 'remover_midia', hid: h.id, tipo: 'foto', arquivo: f.arquivo })
                          }
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white opacity-90 hover:bg-[#c62828] cursor-pointer"
                          title="Remover foto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {h.videoArquivo && (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[#dde3ec] bg-white p-3">
                    <video
                      src={h.videoArquivo}
                      controls
                      preload="metadata"
                      className="h-28 max-w-xs rounded-[8px] bg-black"
                    />
                    <div className="flex-1 min-w-[220px] space-y-2">
                      <label className="block text-xs font-semibold text-[#151a22]">
                        Como este vídeo entra na sessão
                      </label>
                      <select
                        value={h.modoVideo}
                        onChange={(e) => agendarAutoSaveHomenageado(h.id, { modoVideo: e.target.value })}
                        className="w-full max-w-sm rounded-[8px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs"
                      >
                        <option value="com_som">Com som — toca no botão Vídeo</option>
                        <option value="sem_som">Sem som — entra no meio das fotos</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => postAcao({ acao: 'remover_midia', hid: h.id, tipo: 'video' })}
                      className="rounded-[8px] border border-red-200 px-3 py-1.5 text-xs font-medium text-[#c62828] hover:bg-red-50 cursor-pointer"
                    >
                      Remover vídeo
                    </button>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* 6. Abertura e Encerramento do Cerimonial */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#151a22]">Abertura e encerramento do cerimonial</h2>
          <div>
            <label className="block text-xs font-semibold text-[#151a22] mb-1">Abertura</label>
            <textarea
              rows={10}
              value={sessao.abertura}
              onChange={(e) => agendarAutoSaveSessao({ abertura: e.target.value })}
              className="w-full rounded-[10px] border border-[#dde3ec] p-3 text-xs leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#151a22] mb-1">Encerramento</label>
            <textarea
              rows={10}
              value={sessao.encerramento}
              onChange={(e) => agendarAutoSaveSessao({ encerramento: e.target.value })}
              className="w-full rounded-[10px] border border-[#dde3ec] p-3 text-xs leading-relaxed"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                postAcao({
                  acao: 'salvar_sessao',
                  abertura: sessao.abertura,
                  encerramento: sessao.encerramento,
                })
              }
              className="rounded-[10px] bg-[#1f5fe0] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
            >
              Salvar tudo
            </button>
          </div>
        </section>
      </main>

      {/* Dialog: Novo Homenageado Manual */}
      {modalNovoManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-[#151a22]">Adicionar homenageado manualmente</h2>
            <p className="mt-1 text-xs text-[#5f6b7e]">
              Atende casos especiais fora da fila do SAPL (Regimento Interno, art. 125-A, §5º).
            </p>
            <input
              type="text"
              autoFocus
              value={nomeNovoManual}
              onChange={(e) => setNomeNovoManual(e.target.value)}
              placeholder="Nome completo da pessoa ou entidade"
              className="mt-4 w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalNovoManual(false)}
                className="rounded-[10px] border border-[#dde3ec] px-4 py-2 text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdicionarManual}
                className="rounded-[10px] bg-[#12904a] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(alvoRemover)}
        titulo={`Remover ${alvoRemover?.nome || ''}?`}
        descricao="O homenageado será removido desta sessão (caso tenha vindo do SAPL, voltará a ficar disponível na fila)."
        rotuloConfirmar="Remover da sessão"
        perigoso
        onConfirmar={async () => {
          if (alvoRemover) {
            await postAcao({ acao: 'remover_homenageado', hid: alvoRemover.id });
            setAlvoRemover(null);
          }
        }}
        onCancelar={() => setAlvoRemover(null)}
      />
    </div>
  );
}
