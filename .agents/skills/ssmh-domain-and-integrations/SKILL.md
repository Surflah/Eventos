---
name: ssmh-domain-and-integrations
description: >-
  Domain rules and external integrations for Sessão Solene de Homenagens (SSMH): Regimento Interno
  Art. 125-A, SAPL motion queue scraping, ceremonial script generation, PNG/PDF graphic template
  engine, Google OAuth2/Drive/WhatsApp scheduling, and PautaOnline President Tablet sync.
---

# Domínio Legislativo SSMH & Integrações — Câmara Municipal de Itapoá

## 1. Regras Regimentais (Art. 125-A do Regimento Interno)
- **Data Padrão da Sessão (§2º)**: Ao criar nova sessão solene, sugerir por padrão a **última terça-feira do mês corrente** às `19:00` no `Plenário da Câmara Municipal de Itapoá`.
- **Fila do SAPL (§6º)**: Consultar `https://sapl.itapoa.sc.leg.br` filtrando matérias do tipo **Moção** por ano (com navegação para anos anteriores) e classificar em 4 grupos:
  1. `Prontas para entrega` (aprovadas, identificadas como homenagem/aplausos/congratulações e ainda não entregues);
  2. `Aprovadas, mas não parecem homenagem` (aprovadas — ex.: moções de apelo/repúdio — permitindo editar o nome do homenageado e importar caso necessário);
  3. `Ainda não aprovadas` (em tramitação — apenas consulta);
  4. `Já entregues` (já vinculadas a sessões anteriores, com ação `"Devolver à fila"`).
- **Extração Limpa do PDF da Moção**: Ao importar com download do PDF oficial, remover cabeçalhos repetidos, bloco de assinaturas e carimbos de assinatura digital (`ICP-Brasil`).
- **Inclusão Manual (§5º)**: Permitir adicionar homenageados avulsos sem vínculo prévio com moção do SAPL (ex.: títulos honoríficos ou homenagens especiais).

## 2. Motor Determinístico do Cerimonial
- **Abertura (4 blocos)**: `1. ABERTURA` (lista numerada das moções da noite com autor e homenageado) → `2. FORMAÇÃO DA MESA` (Presidente da sessão + vereadores marcados como **presentes** ordenados pela `Ordem` da Mesa) → `3. PALAVRA DO PRESIDENTE` → `4. MENÇÃO DAS AUTORIDADES` (linhas informadas em `autoridades`).
- **Alerta de Dessincronia de Presença**: Se a lista de vereadores presentes ou quem preside mudar **após** a abertura ter sido gerada, exibir alerta amarelo oferecendo `"Atualizar apenas a abertura"` sem sobrescrever edições manuais nos demais blocos.
- **Blocos por Homenageado (`5..N`)**:
  - `.1 LEITURA DA MOÇÃO ← telão: fotos do homenageado`
  - `.2 VÍDEO` (se vídeo com som: `"Assistam. (exibição do vídeo — áudio aberto na mesa)"`; se sem vídeo: `"(sem vídeo nesta moção)"`)
  - `.3 PALAVRA DO VEREADOR PROPONENTE ← telão: placa`
  - `.4 ENTREGA DA MOÇÃO ← telão: placa · trilha de fundo` (respeitando `como_chamar`: `ao`, `à`, `ao senhor`, `à senhora`, `aos`, `às`)
  - `.5 FOTOS ← telão: placa`
  - `.6 PRONUNCIAMENTO DO HOMENAGEADO` (condicionado à resposta em Pronunciamentos: `Sim, vai falar` + nome/cargo do representante; ocultar fala quando `Não vai falar`).
- **Encerramento**:
  - `PRONUNCIAMENTOS`: Lista automaticamente **apenas os vereadores presentes que NÃO propuseram moção na sessão**, seguido da fala geral do Presidente citando todos os homenageados;
  - `CONSIDERAÇÕES FINAIS (Mestre de Cerimônias)`;
  - `TRANSIÇÃO PARA O ENCERRAMENTO OFICIAL` (Mestre de Cerimônias + fala final de encerramento do Presidente).
- **Estimativa de Tempo**: Exibir contagem de caracteres e tempo estimado de leitura (~890–900 caracteres/minuto).

## 3. Motor de Artes Gráficas (`convite`, `certificado`, `convite_geral`)
- Coordenadas normalizadas `0..1` (`x`, `y`, `largura`, `tamanho` relativo à altura da arte) para independência de resolução.
- Suporte integral aos **18 marcadores** (`{nome}`, `{titulo}`, `{nome_completo}`, `{artigo}`, `{mocao}`, `{proponente}`, `{do_proponente}`, `{tratamento_proponente}`, `{partido_proponente}`, `{data_aprovacao}`, `{motivo}`, `{data_extenso}`, `{data}`, `{hora}`, `{hora_extenso}`, `{presidente}`, `{casa}`, `{municipio}`, `{mocao_pdf}`, `{lista_destaque}`), marcação inline `**negrito**` e `##cor_destaque##`, `maiusculas`, `encolher` (auto-fit dentro de `max_linhas`), ícones (`calendario`, `relogio`, `local`) e QR Code (`{mocao_pdf}`).
- Permitir **override individual por certificado** (`artigo`, `nome_completo` e `texto_concessao`) sem alterar o modelo global.

## 4. Comunicações, Agendador e Integração com PautaOnline
- **Envio de E-mail**: Se o operador entrou com Google OAuth próprio, dispara pelo Gmail dele; se entrou com senha compartilhada ou disparo automático agendado, sai pela Conta Google institucional (`eventos@camaraitapoa.sc.gov.br`), respeitando `remetente_nome`, `responder_para` e `copia_para` (BCC).
- **Janela do Agendador Automático**: Respeitar `envio_hora_inicio`–`envio_hora_fim` (padrão `8h–19h`) e `hora_lembretes` (`9h`):
  - Convite geral: **sexta-feira anterior** à sessão + **véspera da sessão** com prefixo `LEMBRETE:`;
  - Cobrança de mídia pendente aos gabinetes: por e-mail até Faltarem > 2 dias; a **2 dias da sessão**, cobrança automática via WhatsApp nos números cadastrados do gabinete.
- **Integração com Tablet do Presidente**: Criar/atualizar de forma idempotente (sem duplicar itens de mesmo título) a sessão `Sessão Solene Mensal de Homenagens - DD/MM/AAAA` com os 3 itens do Presidente (`Abertura Oficial`, `Pronunciamento Presidência`, `Encerramento`), suportando integração direta com o novo **PautaOnline** (`https://pauta.camaraitapoa.sc.gov.br`).
