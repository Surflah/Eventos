'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginConteudo() {
  const router = useRouter();
  const sp = useSearchParams();
  const voltar = sp.get('voltar') || '/';
  const erroOauth = sp.get('erro_oauth') || '';

  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.error || 'Senha incorreta.');
        return;
      }
      router.push(voltar);
      router.refresh();
    } catch {
      setErro('Falha de comunicação com o servidor.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0d2d4e] via-[#123f6b] to-[#1a528a] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <img
            src="/img/logo-transparente.png"
            alt="Câmara Municipal de Itapoá"
            className="h-16 w-auto object-contain mb-3"
          />
          <span className="inline-block rounded-full bg-[#b8912f]/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#94711c]">
            Câmara Municipal de Itapoá · SC
          </span>
          <h1 className="mt-2 text-xl font-bold text-[#12263a]">
            Sessão Solene de Homenagens
          </h1>
          <p className="mt-1 text-xs text-[#5f6b7e]">
            Gestão regimental de moções, cerimonial, convites, certificados e telão ao vivo
          </p>
        </div>

        {(erro || erroOauth) && (
          <div className="mt-5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#c62828]">
            {erro || erroOauth}
          </div>
        )}

        <div className="mt-6">
          <a
            href={`/api/auth/google?modo=login&voltar=${encodeURIComponent(voltar)}`}
            className="flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-[#123f6b] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1e5a99] transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
            </svg>
            Entrar com a conta da Câmara
          </a>
          <p className="mt-1.5 text-center text-[11px] text-[#5f6b7e]">
            Acesso institucional (@camaraitapoa.sc.gov.br) com envio pelo seu próprio e-mail.
          </p>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#dde3ec]" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#5f6b7e]">
            ou operação local
          </span>
          <div className="h-px flex-1 bg-[#dde3ec]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="senha" className="block text-xs font-semibold text-[#12263a] mb-1">
              Operador de TI, entre com a senha do Painel
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="senha compartilhada da operação"
              className="w-full rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm text-[#151a22] outline-none focus:border-[#1f5fe0] focus:bg-white focus:ring-2 focus:ring-[#1f5fe0]/15"
            />
          </div>
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-[10px] bg-[#1f5fe0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#164bb5] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      <footer className="mt-6 text-center text-xs text-white/75">
        Câmara Municipal de Itapoá · Setor de Tecnologia da Informação e NILI
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#123f6b]" />}>
      <LoginConteudo />
    </Suspense>
  );
}
