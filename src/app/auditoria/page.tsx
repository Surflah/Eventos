'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/Topbar';

interface LogItem {
  id: number;
  usuario: string;
  metodoAuth: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  detalhes: string | null;
  ip: string | null;
  createdAt: string;
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);

  useEffect(() => {
    fetch('/api/auditoria')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setLogs(d.logs || []);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar subtitulo="Controle Interno · Trilha de Auditoria" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6">
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div>
            <h1 className="text-xl font-bold text-[#151a22]">Trilha de Auditoria (Controle Interno)</h1>
            <p className="text-xs text-[#5f6b7e]">
              Registro cronológico de autenticações, criações, edições, envios de convite e uploads externos.
            </p>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Registros de auditoria"
            className="table-wrapper rounded-[10px] border border-[#dde3ec]"
          >
            <table className="text-left text-xs">
              <thead className="bg-[#eef1f7] font-semibold text-[#5f6b7e]">
                <tr>
                  <th className="px-3.5 py-2.5">Data/Hora</th>
                  <th className="px-3.5 py-2.5">Usuário</th>
                  <th className="px-3.5 py-2.5">Ação</th>
                  <th className="px-3.5 py-2.5">Entidade</th>
                  <th className="px-3.5 py-2.5">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dde3ec] bg-white">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-[#f8fafc]">
                    <td className="px-3.5 py-2.5 whitespace-nowrap tabular-nums text-[#5f6b7e]">
                      {new Date(l.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-[#151a22]">
                      {l.usuario}{' '}
                      <span className="text-[10px] text-[#5f6b7e]">({l.metodoAuth})</span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono font-semibold text-[#123f6b]">
                      {l.acao}
                    </td>
                    <td className="px-3.5 py-2.5 text-[#5f6b7e]">
                      {l.entidade}
                      {l.entidadeId ? ` #${l.entidadeId}` : ''}
                    </td>
                    <td className="px-3.5 py-2.5 text-[#151a22]">{l.detalhes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
