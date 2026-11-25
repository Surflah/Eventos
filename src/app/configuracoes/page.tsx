'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';

interface VereadorCfg {
  id?: number;
  nome: string;
  tratamento: string;
  partido: string;
  cargo: string;
  ordem: number;
  email: string;
  whatsapp: string;
  ativo: boolean;
}

interface TrilhaCfg {
  id: number;
  nome: string;
  arquivo: string;
}

interface UsuarioCfg {
  id: number;
  email: string;
  nome: string;
  podeEnviarEmail: boolean;
  ultimoAcesso: string | null;
}

function ConfiguracoesConteudo() {
  const sp = useSearchParams();
  const okUrl = sp.get('ok') || '';
  const erroOauth = sp.get('erro_oauth') || '';

  const [driveKey, setDriveKey] = useState('');
  const [driveKeySalva, setDriveKeySalva] = useState(false);
  const [trilhas, setTrilhas] = useState<TrilhaCfg[]>([]);
  const [vereadores, setVereadores] = useState<VereadorCfg[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCfg[]>([]);

  // Google OAuth & Casa
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [secretSalvo, setSecretSalvo] = useState(false);
  const [googleCasaEmail, setGoogleCasaEmail] = useState('eventos@camaraitapoa.sc.gov.br');
  const [googleCasaConectada, setGoogleCasaConectada] = useState(false);
  const [googleCasaAutorizadoEm, setGoogleCasaAutorizadoEm] = useState('');
  const [emailTeste, setEmailTeste] = useState('eventos@camaraitapoa.sc.gov.br');

  const [remetenteNome, setRemetenteNome] = useState('Setor de Eventos - Câmara de Itapoá');
  const [responderPara, setResponderPara] = useState('');
  const [copiaPara, setCopiaPara] = useState('');
  const [envioHoraInicio, setEnvioHoraInicio] = useState(8);
  const [envioHoraFim, setEnvioHoraFim] = useState(19);
  const [horaLembretes, setHoraLembretes] = useState(9);

  const [dominiosLogin, setDominiosLogin] = useState('camaraitapoa.sc.gov.br');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch('/api/configuracoes');
    const d = await r.json();
    if (!d.ok) return;

    const c = d.config;
    setDriveKeySalva(c.googleApiKeyConfigurada);
    setClientId(c.googleOauthClientId || '');
    setSecretSalvo(c.googleOauthSecretConfigurado);
    setGoogleCasaEmail(c.googleCasaEmail);
    setGoogleCasaConectada(c.googleCasaConectada);
    setGoogleCasaAutorizadoEm(c.googleCasaAutorizadoEm);
    setRemetenteNome(c.remetenteNome);
    setResponderPara(c.responderPara);
    setCopiaPara(c.copiaPara);
    setEnvioHoraInicio(c.envioHoraInicio);
    setEnvioHoraFim(c.envioHoraFim);
    setHoraLembretes(c.horaLembretes);
    setDominiosLogin(c.dominiosLogin);

    setTrilhas(d.trilhas || []);
    setUsuarios(d.usuarios || []);
    setVereadores([
      ...(d.vereadores || []),
      {
        nome: '',
        tratamento: 'Vereador',
        partido: '',
        cargo: '',
        ordem: 10,
        email: '',
        whatsapp: '',
        ativo: true,
      },
    ]);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function postJson(payload: Record<string, unknown>, msgSucesso: string) {
    setAviso(null);
    const r = await fetch('/api/configuracoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.ok) {
      setAviso({ tipo: 'ok', msg: msgSucesso });
      await carregar();
    } else {
      setAviso({ tipo: 'erro', msg: d.error || 'Falha ao salvar.' });
    }
  }

  async function handleUploadTrilha(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append('trilha', file);
    const r = await fetch('/api/configuracoes', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.ok) {
      setAviso({ tipo: 'ok', msg: 'Trilha sonora adicionada!' });
      await carregar();
    }
  }

  async function handleTrocarSenha(e: FormEvent) {
    e.preventDefault();
    await postJson(
      { acao: 'trocar_senha', atual: senhaAtual, nova: senhaNova },
      'Senha do painel alterada com sucesso!'
    );
    setSenhaAtual('');
    setSenhaNova('');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar subtitulo="Configurações Globais" />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        {(aviso || okUrl || erroOauth) && (
          <div
            className={`rounded-[12px] border px-4 py-3 text-xs font-medium ${
              aviso?.tipo === 'erro' || erroOauth
                ? 'border-red-200 bg-red-50 text-[#c62828]'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {aviso?.msg || erroOauth || okUrl}
          </div>
        )}

        {/* 1. Chave Google Drive API */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-[#151a22]">1. Chave da API do Google (Drive)</h2>
          <p className="text-xs leading-relaxed text-[#5f6b7e]">
            Permite ler pastas compartilhadas como &quot;Qualquer pessoa com o link&quot; na tela de
            montagem. A chave fica criptografada no servidor e nunca é exposta no HTML.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={driveKey}
              onChange={(e) => setDriveKey(e.target.value)}
              placeholder={driveKeySalva ? '•••••••• (chave já salva — digite para substituir)' : 'AIza...'}
              className="flex-1 min-w-[260px] rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => {
                void postJson({ acao: 'salvar_drive_key', googleApiKey: driveKey }, 'Chave Google Drive salva!');
                setDriveKey('');
              }}
              className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
            >
              Salvar chave
            </button>
          </div>
        </section>

        {/* 2. Trilhas para a entrega */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#151a22]">2. Trilhas para a entrega</h2>
          <p className="text-xs text-[#5f6b7e]">
            Instrumental, sem voz. Toca em loop e com fade suave durante a entrega da moção no plenário.
          </p>

          <div className="divide-y divide-[#dde3ec] rounded-[10px] border border-[#dde3ec]">
            {trilhas.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
                <span className="font-semibold text-[#151a22]">{t.nome}</span>
                <div className="flex items-center gap-3">
                  <audio controls preload="none" src={`/midia/_trilhas/${t.arquivo}`} className="h-8" />
                  <button
                    type="button"
                    onClick={() => postJson({ acao: 'remover_trilha', arquivo: t.arquivo }, 'Trilha removida.')}
                    className="rounded-[8px] border border-red-200 px-2.5 py-1 text-[#c62828] hover:bg-red-50 cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-[#151a22] hover:bg-[#eef1f7] cursor-pointer">
            <span>+ Enviar trilha (MP3 / WAV)</span>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => handleUploadTrilha(e.target.files?.[0])}
              className="hidden"
            />
          </label>
        </section>

        {/* 3. Composição da Casa */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#151a22]">3. Composição da Casa</h2>
            <p className="text-xs leading-relaxed text-[#5f6b7e]">
              Fonte oficial de grafia do nome, partido, tratamento, e-mail do gabinete e WhatsApp. Ordem
              organiza a chamada da mesa (1–4 Mesa Diretora, 10 os demais). A última linha em branco inclui
              novo parlamentar; apagar o nome remove.
            </p>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Composição da Câmara Municipal"
            className="table-wrapper rounded-[10px] border border-[#dde3ec]"
          >
            <table className="text-xs">
              <thead className="bg-[#eef1f7] font-semibold text-[#5f6b7e]">
                <tr>
                  <th className="p-2.5 text-left min-w-[200px]">Nome</th>
                  <th className="p-2.5 text-left">Tratamento</th>
                  <th className="p-2.5 text-left">Partido</th>
                  <th className="p-2.5 text-left">Cargo na Mesa</th>
                  <th className="p-2.5 text-left w-16">Ordem</th>
                  <th className="p-2.5 text-left min-w-[210px]">E-mail do gabinete</th>
                  <th className="p-2.5 text-left min-w-[140px]">WhatsApp</th>
                  <th className="p-2.5 text-center">Em exercício</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dde3ec] bg-white">
                {vereadores.map((v, i) => (
                  <tr key={i}>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.nome}
                        placeholder="nome completo"
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, nome: e.target.value } : x))
                          )
                        }
                        className="w-full rounded border border-[#dde3ec] px-2 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={v.tratamento}
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, tratamento: e.target.value } : x))
                          )
                        }
                        className="rounded border border-[#dde3ec] bg-white px-2 py-1"
                      >
                        <option value="Vereador">Vereador</option>
                        <option value="Vereadora">Vereadora</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.partido}
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, partido: e.target.value } : x))
                          )
                        }
                        className="w-28 rounded border border-[#dde3ec] px-2 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.cargo}
                        placeholder="—"
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, cargo: e.target.value } : x))
                          )
                        }
                        className="w-32 rounded border border-[#dde3ec] px-2 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={v.ordem}
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, ordem: Number(e.target.value) } : x))
                          )
                        }
                        className="w-14 rounded border border-[#dde3ec] px-2 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="email"
                        value={v.email}
                        placeholder="gabinete@camaraitapoa.sc.gov.br"
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, email: e.target.value } : x))
                          )
                        }
                        className="w-full rounded border border-[#dde3ec] px-2 py-1 font-mono text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.whatsapp}
                        placeholder="47 99999-9999"
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, whatsapp: e.target.value } : x))
                          )
                        }
                        className="w-full rounded border border-[#dde3ec] px-2 py-1"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={v.ativo}
                        onChange={(e) =>
                          setVereadores((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, ativo: e.target.checked } : x))
                          )
                        }
                        className="h-4 w-4 rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() =>
              postJson({ acao: 'salvar_composicao', vereadores }, 'Composição da Casa atualizada!')
            }
            className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
          >
            Salvar composição
          </button>
        </section>

        {/* 4. Conta Google da Casa & Envio */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#151a22]">4. Conta Google da Casa e Disparos</h2>

          <div className="rounded-[10px] border border-[#dde3ec] bg-[#f8fafc] p-4 space-y-3">
            <div className="text-xs font-semibold text-[#151a22]">
              Credenciais OAuth2 Google Cloud (Client ID / Secret)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID (...apps.googleusercontent.com)"
                className="rounded-[8px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-mono"
              />
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={secretSalvo ? '•••••••• (Client Secret salvo)' : 'Client Secret'}
                className="rounded-[8px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void postJson(
                    { acao: 'salvar_oauth_credenciais', clientId, clientSecret },
                    'Credenciais OAuth salvas!'
                  );
                  setClientSecret('');
                }}
                className="rounded-[8px] border border-[#dde3ec] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#eef1f7] cursor-pointer"
              >
                Salvar credenciais OAuth
              </button>
              <a
                href="/api/auth/google?modo=casa"
                className="rounded-[8px] bg-[#123f6b] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1e5a99]"
              >
                {googleCasaConectada
                  ? `Reconectar (${googleCasaEmail})`
                  : 'Conectar Conta Google da Casa'}
              </a>
              {googleCasaConectada && (
                <button
                  type="button"
                  onClick={() => postJson({ acao: 'desconectar_google_casa' }, 'Conta desconectada.')}
                  className="rounded-[8px] border border-red-200 bg-white px-3 py-1.5 text-xs text-[#c62828] hover:bg-red-50 cursor-pointer"
                >
                  Desconectar e revogar
                </button>
              )}
            </div>
            {googleCasaConectada && googleCasaAutorizadoEm && (
              <p className="text-[11px] text-emerald-800">
                ✓ Conectado como <strong>{googleCasaEmail}</strong>.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">
                Enviar um teste para
              </label>
              <input
                type="email"
                value={emailTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                postJson({ acao: 'enviar_teste', destino: emailTeste }, `Teste enviado para ${emailTeste}!`)
              }
              className="rounded-[10px] border border-[#dde3ec] bg-white px-4 py-2 text-xs font-semibold hover:bg-[#eef1f7] cursor-pointer"
            >
              Enviar teste
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#151a22] mb-1">
                Nome que aparece como remetente
              </label>
              <input
                type="text"
                value={remetenteNome}
                onChange={(e) => setRemetenteNome(e.target.value)}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#151a22] mb-1">
                Responder para (opcional)
              </label>
              <input
                type="email"
                value={responderPara}
                onChange={(e) => setResponderPara(e.target.value)}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#151a22] mb-1">
                Cópia oculta de cada envio (opcional, separe por vírgula)
              </label>
              <input
                type="text"
                value={copiaPara}
                onChange={(e) => setCopiaPara(e.target.value)}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="border-t border-dashed border-[#dde3ec] pt-3 space-y-2">
            <label className="block text-xs font-semibold text-[#151a22]">
              Horário em que o sistema pode enviar sozinho
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span>das</span>
              <input
                type="number"
                min={0}
                max={23}
                value={envioHoraInicio}
                onChange={(e) => setEnvioHoraInicio(Number(e.target.value))}
                className="w-16 rounded-[8px] border border-[#dde3ec] px-2 py-1"
              />
              <span>h às</span>
              <input
                type="number"
                min={1}
                max={24}
                value={envioHoraFim}
                onChange={(e) => setEnvioHoraFim(Number(e.target.value))}
                className="w-16 rounded-[8px] border border-[#dde3ec] px-2 py-1"
              />
              <span className="ml-3">lembretes a partir das</span>
              <input
                type="number"
                min={0}
                max={23}
                value={horaLembretes}
                onChange={(e) => setHoraLembretes(Number(e.target.value))}
                className="w-16 rounded-[8px] border border-[#dde3ec] px-2 py-1"
              />
              <span>h</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              postJson(
                {
                  acao: 'salvar_dados_envio',
                  remetenteNome,
                  responderPara,
                  copiaPara,
                  envioHoraInicio,
                  envioHoraFim,
                  horaLembretes,
                },
                'Dados de envio salvos!'
              )
            }
            className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
          >
            Salvar dados de envio
          </button>
        </section>

        {/* 5. Quem entra no painel */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#151a22]">5. Quem entra no painel</h2>
          {usuarios.length > 0 && (
            <div className="divide-y divide-[#dde3ec] rounded-[10px] border border-[#dde3ec] text-xs">
              {usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-semibold text-[#151a22]">{u.email}</div>
                    <div className="text-[11px] text-[#5f6b7e]">
                      Pode enviar e-mail: {u.podeEnviarEmail ? 'sim' : 'não'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      postJson({ acao: 'remover_usuario', email: u.email }, 'Conta removida.')
                    }
                    className="rounded-[8px] border border-red-200 px-2.5 py-1 text-[#c62828] hover:bg-red-50 cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#151a22]">
              Domínios Google que podem entrar
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={dominiosLogin}
                onChange={(e) => setDominiosLogin(e.target.value)}
                className="flex-1 rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() =>
                  postJson({ acao: 'salvar_dominios', dominiosLogin }, 'Domínios autorizados salvos!')
                }
                className="rounded-[10px] border border-[#dde3ec] bg-white px-4 py-2 text-xs font-semibold hover:bg-[#eef1f7] cursor-pointer"
              >
                Salvar domínios
              </button>
            </div>
          </div>
        </section>

        {/* 6. Senha de acesso */}
        <section className="rounded-[14px] border border-[#dde3ec] bg-white p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-[#151a22]">6. Senha compartilhada de acesso</h2>
          <form onSubmit={handleTrocarSenha} className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-[#151a22] mb-1">Senha atual</label>
              <input
                type="password"
                required
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#151a22] mb-1">
                Nova senha (mín. 8 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                className="w-full rounded-[10px] border border-[#dde3ec] px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="rounded-[10px] bg-[#1f5fe0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164bb5] cursor-pointer"
            >
              Trocar senha
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f6fa]" />}>
      <ConfiguracoesConteudo />
    </Suspense>
  );
}
