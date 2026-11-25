'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { calcularProximaUltimaTerca, formatarDataCurta } from '@/core/regimento';

interface ResumoSessao {
  id: string;
  titulo: string;
  numero: string;
  local: string;
  data: string;
  hora: string;
  arquivada: boolean;
  totalHomenageados: number;
  totalFotos: number;
  totalVideos: number;
}

export default function HomePage() {
  const router = useRouter();
  const [sessoes, setSessoes] = useState<ResumoSessao[]>([]);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Formulário manual
  const [titulo, setTitulo] = useState('Sessão Solene de Homenagens');
  const [numero, setNumero] = useState('');
  const [data, setData] = useState(() => calcularProximaUltimaTerca());
  const [hora, setHora] = useState('19:00');
  const [driveUrl, setDriveUrl] = useState('');
  const [criando, setCriando] = useState(false);

  // Modal de exclusão segura
  const [alvoExcluir, setAlvoExcluir] = useState<ResumoSessao | null>(null);

  const carregarSessoes = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/sessoes${mostrarArquivadas ? '?arquivadas=1' : ''}`);
      const d = await r.json();
      if (d.ok) setSessoes(d.sessoes || []);
    } finally {
      setCarregando(false);
    }
  }, [mostrarArquivadas]);

  useEffect(() => {
    void carregarSessoes();
  }, [carregarSessoes]);

  async function handleCriarManual(e: FormEvent) {
    e.preventDefault();
    setCriando(true);
    try {
      const res = await fetch('/api/sessoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, numero, data, hora, driveUrl }),
      });
      const json = await res.json();
      if (json.ok && json.sessao?.id) {
        router.push(`/sessoes/${json.sessao.id}`);
      }
    } finally {
      setCriando(false);
    }
  }

  async function handleArquivar(s: ResumoSessao) {
    await fetch(`/api/sessoes/${s.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'arquivar_sessao', arquivada: !s.arquivada }),
    });
    await carregarSessoes();
  }

  async function confirmarExclusao() {
    if (!alvoExcluir) return;
    await fetch(`/api/sessoes/${alvoExcluir.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'excluir_sessao' }),
    });
    setAlvoExcluir(null);
    await carregarSessoes();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-7">
        {/* Card 1: Sessões Cadastradas */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#151a22]">Sessões cadastradas</h1>
              <p className="text-xs text-[#5f6b7e]">
                Gerencie a preparação, os convites, o cerimonial ou abra a Operação de TI ao vivo.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#5f6b7e] cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarArquivadas}
                onChange={(e) => setMostrarArquivadas(e.target.checked)}
                className="rounded border-[#dde3ec]"
              />
              Mostrar arquivadas
            </label>
          </div>

          {carregando ? (
            <p className="py-8 text-center text-sm text-[#5f6b7e]">Carregando sessões...</p>
          ) : sessoes.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[#dde3ec] bg-[#f4f6fa] p-8 text-center">
              <p className="text-sm font-medium text-[#151a22]">Nenhuma sessão cadastrada ainda.</p>
              <p className="mt-1 text-xs text-[#5f6b7e]">
                Comece importando a fila de moções aprovadas do SAPL logo abaixo ou crie uma sessão manual.
              </p>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Tabela de sessões solenes cadastradas"
              className="table-wrapper rounded-[10px] border border-[#dde3ec]"
            >
              <table className="text-left text-sm">
                <thead className="bg-[#eef1f7] text-xs font-semibold uppercase tracking-wide text-[#5f6b7e]">
                  <tr>
                    <th className="px-4 py-3">Sessão</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Homenageados</th>
                    <th className="px-4 py-3">Mídia</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dde3ec] bg-white">
                  {sessoes.map((s) => (
                    <tr key={s.id} className={s.arquivada ? 'opacity-60 bg-slate-50' : 'hover:bg-[#f8fafc]'}>
                      <th scope="row" className="px-4 py-3.5 font-semibold text-[#151a22]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{s.titulo}</span>
                          {s.numero && (
                            <span className="rounded-full bg-[#12904a]/12 px-2.5 py-0.5 text-[11px] font-bold uppercase text-[#0c7239]">
                              {s.numero}
                            </span>
                          )}
                          {s.arquivada && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              ARQUIVADA
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs font-normal text-[#5f6b7e]">{s.local}</div>
                      </th>
                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                        <div className="font-medium text-[#151a22]">{formatarDataCurta(s.data)}</div>
                        <div className="text-xs text-[#5f6b7e]">{s.hora}</div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-[#151a22]">
                        {s.totalHomenageados}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#5f6b7e] tabular-nums">
                        <div>{s.totalFotos} foto(s)</div>
                        <div>{s.totalVideos} vídeo(s)</div>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/sessoes/${s.id}`}
                            className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#164bb5] transition-colors"
                          >
                            Gerenciar
                          </Link>
                          <Link
                            href={`/sessoes/${s.id}/controle`}
                            className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7] transition-colors"
                          >
                            Operação de TI
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleArquivar(s)}
                            className="rounded-[10px] border border-[#dde3ec] bg-white px-2.5 py-1.5 text-xs text-[#5f6b7e] hover:bg-[#eef1f7] cursor-pointer"
                            title={s.arquivada ? 'Restaurar sessão' : 'Arquivar sessão'}
                          >
                            {s.arquivada ? 'Restaurar' : 'Arquivar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAlvoExcluir(s)}
                            className="rounded-[10px] border border-red-200 bg-white px-2.5 py-1.5 text-xs text-[#c62828] hover:bg-red-50 cursor-pointer"
                            title="Excluir sessão permanentemente"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Card 2: Começar pelo SAPL */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#1f5fe0]">
                Fluxo Recomendado · Art. 125-A do Regimento Interno
              </span>
              <h2 className="mt-1.5 text-lg font-bold text-[#151a22]">Começar pelo SAPL</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5f6b7e]">
                Consulta diretamente o SAPL da Câmara (`sapl.itapoa.sc.leg.br`), separa as Moções de Aplausos
                aprovadas ainda não entregues (art. 125-A, §6º), extrai o texto oficial do PDF sem carimbos
                digitais e já vincula cada gabinete proponente.
              </p>
            </div>
            <Link
              href="/importar"
              className="rounded-[10px] bg-[#12904a] px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-[#0c7239] transition-colors"
            >
              Montar sessão a partir do SAPL
            </Link>
          </div>
        </section>

        {/* Card 3: Criar sessão manualmente */}
        <details className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs group">
          <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-semibold text-[#151a22]">
            <span>Criar sessão manualmente, sem o SAPL</span>
            <span className="text-xs text-[#5f6b7e] group-open:rotate-180 transition-transform">▼</span>
          </summary>

          <form onSubmit={handleCriarManual} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">Título *</label>
              <input
                type="text"
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#151a22] mb-1">Número / edição</label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="ex.: 8ª"
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#151a22] mb-1">Data *</label>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full rounded-[10px] border border-[#dde3ec] px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#151a22] mb-1">Hora</label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full rounded-[10px] border border-[#dde3ec] px-2.5 py-2 text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">
                Link da pasta do Google Drive (opcional)
              </label>
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={criando}
                className="w-full rounded-[10px] bg-[#1f5fe0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#164bb5] disabled:opacity-60 cursor-pointer"
              >
                {criando ? 'Criando...' : 'Criar sessão'}
              </button>
            </div>
          </form>
        </details>
      </main>

      <footer className="border-t border-[#dde3ec] bg-white py-4 text-center text-xs text-[#5f6b7e]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between px-4 gap-2">
          <span>Câmara Municipal de Itapoá · Sistema de Sessão Solene de Homenagens (SSMH)</span>
          <div className="flex gap-4">
            <Link href="/modelos" className="text-[#1f5fe0] hover:underline">
              Modelos de Convite e Certificado
            </Link>
            <Link href="/contatos" className="text-[#1f5fe0] hover:underline">
              Contatos da Casa
            </Link>
            <Link href="/configuracoes" className="text-[#1f5fe0] hover:underline">
              Configurações
            </Link>
          </div>
        </div>
      </footer>

      <ConfirmDialog
        open={Boolean(alvoExcluir)}
        titulo="Excluir sessão solene?"
        descricao={`Tem certeza que deseja excluir permanentemente "${alvoExcluir?.titulo}" (${
          alvoExcluir ? formatarDataCurta(alvoExcluir.data) : ''
        }) e todos os seus materiais? Caso queira apenas ocultá-la da lista ativa, utilize o botão Arquivar.`}
        rotuloConfirmar="Excluir permanentemente"
        perigoso
        onConfirmar={confirmarExclusao}
        onCancelar={() => setAlvoExcluir(null)}
      />
    </div>
  );
}
