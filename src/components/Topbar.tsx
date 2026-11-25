'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  sessaoId?: string;
  subtitulo?: string;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

export function Topbar({ sessaoId, subtitulo, autoSaveStatus }: TopbarProps) {
  const router = useRouter();

  async function handleSair() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#dde3ec] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/img/logo-transparente.png"
            alt="Câmara Municipal de Itapoá"
            className="h-10 w-auto object-contain"
          />
          <div>
            <div className="text-base font-bold leading-tight text-[#151a22] group-hover:text-[#1f5fe0] transition-colors">
              Sessão Solene de Homenagens
            </div>
            <div className="text-xs text-[#5f6b7e]">
              Câmara Municipal de Itapoá{subtitulo ? ` · ${subtitulo}` : ''}
            </div>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {autoSaveStatus && (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                autoSaveStatus === 'saving'
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : autoSaveStatus === 'error'
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-[#dde3ec] bg-[#f4f6fa] text-[#5f6b7e]'
              }`}
            >
              {autoSaveStatus === 'saving'
                ? 'salvando alterações...'
                : autoSaveStatus === 'saved'
                ? 'salvo automaticamente ✓'
                : autoSaveStatus === 'error'
                ? 'erro ao salvar'
                : 'salvamento automático ligado'}
            </span>
          )}

          {sessaoId && (
            <Link
              href={`/sessoes/${sessaoId}`}
              className="rounded-[10px] bg-[#1f5fe0] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] transition-colors"
            >
              Checklist
            </Link>
          )}

          <Link
            href="/configuracoes"
            className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-xs font-medium text-[#151a22] hover:bg-[#eef1f7] transition-colors"
          >
            Configurações
          </Link>

          <Link
            href="/auditoria"
            className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-xs font-medium text-[#5f6b7e] hover:bg-[#eef1f7] transition-colors"
          >
            Auditoria
          </Link>

          <button
            type="button"
            onClick={handleSair}
            className="rounded-[10px] border border-[#dde3ec] bg-white px-3 py-2 text-xs font-medium text-[#151a22] hover:bg-red-50 hover:text-[#c62828] hover:border-red-200 transition-colors cursor-pointer"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
