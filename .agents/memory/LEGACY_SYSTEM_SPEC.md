# Especificação Técnica Reversa Completa — Sistema Legado (`camara.itapoa.digital/eventos/`)

> **Dica de Economia de Tokens**: Leia apenas o intervalo de linhas do módulo necessário usando `StartLine` e `EndLine`:
> - **Seção 1 (Visão Geral, Rotas e Autenticação)**: linhas `15–47`
> - **Seção 2 (Tela Inicial, Importação SAPL e Regimento Art. 125-A)**: linhas `48–68`
> - **Seção 3 (Montagem da Sessão, Checklist 12 Itens e Homenageados)**: linhas `69–111`
> - **Seção 4 (Entregáveis, Modelos Gráficos e Coordenadas Exatas)**: linhas `112–149`
> - **Seção 5 (Contatos, Mídias, Pronunciamentos, Presença e Tablet)**: linhas `150–171`
> - **Seção 6 (Motor do Cerimonial Completo e Textos Literais)**: linhas `172–196`
> - **Seção 7 (Operação de TI Ao Vivo `controle` e Palco 16:9 `telao`)**: linhas `197–220`
> - **Seção 8 (Configurações Globais, Composição da Casa e Design Tokens)**: linhas `221–235`

---

## 1. Visão Geral, Rotas e Autenticação

- **Nome Institucional**: **Sessão Solene de Homenagens (SSMH)** — Câmara Municipal de Itapoá/SC.
- **Stack Original**: PHP server-rendered + JavaScript Vanilla + CSS único `/eventos/assets/app.css` (`21.326` bytes) + fontes locais `Poppins` (`400, 500, 600, 700`) e fontes gráficas (`Cinzel`, `GreatVibes`, `PTSerif`, `PlayfairDisplay`), hospedado sob Nginx + Cloudflare.
- **Comportamento sem autenticação**: Não há calendário público nem listagem pública em `/eventos/`. Qualquer acesso sem sessão ativa retorna `HTTP 302` para `/eventos/login.php?voltar=%2Feventos%2F`. A única página pública é `/eventos/enviar.php?t=<token>` (upload externo de mídias do homenageado).

### Mapa Completo das 19 Rotas
1. `login.php` / `sair.php` — Autenticação dual e encerramento de sessão.
2. `index.php` — Lista de sessões cadastradas + atalho SAPL + formulário expansível de criação manual.
3. `importar.php` (e `?s=<id>&ano=<YYYY>&atualizar=1`) — Criação de sessão + fila de moções do SAPL.
4. `sapl_api.php` — API assíncrona do SAPL (`GET ?a=aquecer&ano=<YYYY>&token=...` e `GET ?a=progresso&token=...`).
5. `sessao.php?s=<id>` — Tela central de montagem, checklist de 12 itens, presença, textos e cards de homenageados.
6. `api.php` — API interna (`GET ?a=estado` para sincronia do palco/leitor; `POST` para auto-save da sessão, CRUD/reordenação de homenageados, checklist e varredura de vídeos no disco).
7. `entregaveis.php?s=<id>` — Disparo de convite+link ao gabinete proponente, download PNG/PDF de convites e certificados e ajuste individual do certificado.
8. `arte.php?m={convite|certificado|convite_geral}&s=<id>[&h=<hid>][&w=420][&lote=1][&f=pdf][&baixar=1]` — Renderizador de PNGs e PDFs individuais ou em lote.
9. `thumb.php?t=&f=<arquivo>` — Gerador de miniaturas das fotos na montagem.
10. `modelos.php?m={convite|certificado|convite_geral}&s=<id>` — Editor posicional de artes de fundo, blocos e marcadores.
11. `contatos.php?s=<id>` — Cadastro dos 41 contatos institucionais e disparo manual/agendado do Convite Geral.
12. `midias.php?s=<id>` — Painel de conferência de mídias entregues e contagem regressiva de fechamento do prazo.
13. `pronunciamentos.php?s=<id>` — Definição de quem usa a palavra e representante/cargo por homenageado.
14. `presenca.php?s=<id>` — Definição de quem preside, vereadores presentes e autoridades presentes.
15. `tablet.php?s=<id>` (e auxiliar `pauta.php`) — Exportação idempotente das 3 falas do Presidente para o sistema de pauta (`camara.itapoa.digital/pauta/`).
16. `textos-cerimonial.php?s=<id>` — Editor focado de abertura, blocos das moções e encerramento.
17. `documento.php?s=<id>` — Compilação integral do cerimonial com métricas, impressão/PDF, cópia e `.txt`.
18. `cerimonial.php?s=<id>` — Modo leitor ao vivo para o tablet do Mestre de Cerimônias (`A−`, `A+`, `Seguir: ON`).
19. `controle.php?s=<id>` e `telao.php?s=<id>` — Console de Operação de TI e Palco de Projeção 16:9 ao vivo; `configuracoes.php` — Parâmetros globais.

### Autenticação Dual (`login.php`)
- **Método 1 — Google OAuth (`"Entrar com a conta da Câmara"`)**: Restrito aos domínios autorizados (`camaraitapoa.sc.gov.br`). Cada servidor guarda sua própria autorização OAuth2; quando ele dispara convites ao gabinete em `entregaveis.php`, o e-mail sai do endereço dele e as respostas voltam para ele.
- **Método 2 — Senha Compartilhada (`"Operador de TI, entre com a senha do Painel"`)**: Campo único `input[name="senha"]` (sem seletor de usuário). Usado como contingência ou pela operação de TI; envios feitos sob esse login saem pela Conta Google institucional (`eventos@camaraitapoa.sc.gov.br`).

---

## 2. Tela Inicial, Importação SAPL e Regimento Art. 125-A

### Tela Inicial (`index.php`)
- **Tabela `Sessões cadastradas`**: Colunas `Sessão` (título, badge verde opcional com `numero`/edição e `local`), `Data` (`DD/MM/AAAA` + `HH:MM`), `Homenageados` (total), `Mídia` (`X foto(s)` / `Y vídeo(s)`), Ações: `Gerenciar` (`sessao.php?s=<id>`) e `Operação de TI` (`controle.php?s=<id>`). *Limitação do legado:* não há botão para excluir ou arquivar sessões criadas.
- **Criação pelo SAPL**: Botão primário `Montar sessão a partir do SAPL` (`importar.php`), citando o art. 125-A, §6º do Regimento Interno.
- **Criação Manual (`<details>` expansível)**:
  - `titulo` (`text`, obrigatório, padrão `"Sessão Solene de Homenagens"`), `numero` (`text`, opcional, placeholder `"ex.: 8ª"`), `data` (`date`, obrigatório), `hora` (`time`, padrão `"19:00"`), `drive_url` (`url`, opcional, pasta do Google Drive). Slug de ID gerado no padrão `YYYY-MM-DD-slug-do-titulo`.

### Importação do SAPL (`importar.php` + `sapl_api.php`)
- **Criação rápida (`importar.php` sem `?s=`)**: Calcula automaticamente a **última terça-feira do mês** como `data` padrão (Regimento Interno, art. 125-A, §2º), `hora` = `19:00`, `numero` opcional → botão `Criar e buscar moções`.
- **Fila de Moções (`importar.php?s=<id>[&ano=YYYY][&atualizar=1]`)**:
  - Exibe modal de progresso (`0%–100%`) consultando `sapl.itapoa.sc.leg.br` via `sapl_api.php?a=aquecer` e `sapl_api.php?a=progresso`.
  - Botões de navegação por ano (`Ver 2025`, `Ver 2024`, etc.), `Atualizar do SAPL` e `Ir para a montagem`.
  - **4 seções de classificação**:
    1. **Prontas para entrega**: Moções aprovadas identificadas como homenagem/aplausos/congratulações ainda não entregues. Checkboxes de seleção + checkbox `baixar também o texto da moção do PDF oficial` (marcado por padrão) + botão `Importar as marcadas para esta sessão`.
    2. **Aprovadas, mas não parecem homenagem** (acordeão): Moções aprovadas cujo assunto aparenta ser apelo/repúdio/outro. Possui checkbox + input `Homenageado` editável para corrigir o nome extraído da ementa + `Importar as marcadas`.
    3. **Ainda não aprovadas** (acordeão): Moções em tramitação (somente leitura; ex.: 37 registros em 2025).
    4. **Já entregues** (acordeão): Moções já vinculadas a sessões anteriores, cada uma com botão individual `Devolver à fila`.

---

## 3. Montagem da Sessão, Checklist (12 Itens) e Homenageados (`sessao.php`)

- Possui pill flutuante `"salvamento automático ligado"` que envia alterações por `POST /eventos/api.php`.

### Checklist de Preparação (12 Itens)
- **Antes da sessão (7 itens)**:
  1. `sapl` (automático ao ter homenageados) — Importar moções do SAPL (`importar.php`).
  2. `agenda` (manual) — Criar evento na Google Agenda.
  3. `convite_prop` (manual) — Enviar convite e link de mídias aos gabinetes proponentes (`entregaveis.php`).
  4. `convite_casa` (manual) — Disparar/agendar convite geral aos contatos da Casa (`contatos.php`).
  5. `textos` (automático quando textos estão preenchidos) — Revisar textos do cerimonial (`textos-cerimonial.php`).
  6. `midias_ok` (manual) — Conferir fotos e vídeos recebidos (`midias.php`).
  7. `pronunciamentos` (manual) — Confirmar uso da palavra e representantes (`pronunciamentos.php`).
- **No dia da sessão (5 itens)**:
  8. `certificados` (manual) — Baixar/imprimir PDF dos certificados (`entregaveis.php`).
  9. `tablet` (manual) — Atualizar sessão no tablet do presidente (`tablet.php`).
  10. `presenca` (manual) — Marcar vereadores e autoridades presentes (`presenca.php`).
  11. `textos_dia` (manual, exibe alerta se a presença mudou após gerar abertura) — Atualizar abertura e revisar cerimonial (`textos-cerimonial.php`).
  12. `midias` (manual) — Testar telão, vídeos e trilha na Operação de TI (`controle.php`).

### Seções e Campos de `sessao.php`
1. **Dados da sessão**: `titulo`, `numero`, `local` (padrão `"Plenário da Câmara Municipal de Itapoá"`), `data`, `hora`, `presidente` (`select` com vereadores), `drive_url`, botões `Salvar dados` e `Ler pasta do Drive`.
2. **Vereadores presentes e autoridades**: Botões `Marcar todos` / `Desmarcar todos`, contador `X de 10 presentes`, checkboxes dos vereadores, alerta condicional + botão `Atualizar a abertura`, textarea `autoridades` (uma por linha).
3. **Textos do cerimonial & Casos manuais**: Botões `Gerar textos que faltam`, `Ver cerimonial completo` (`documento.php`), `Regerar todos os textos`, e seção expansível `Mídia e casos manuais` com:
   - `Procurar vídeos que subi pelo painel` (lê `/midia/<sessao>/<hid>/video/` no disco para contornar limite ~100 MB do Cloudflare);
   - `+ Adicionar homenageado manualmente` (atende art. 125-A, §5º).
4. **Cards de Homenageados (`1..N`, IDs no formato `h` + 8 hex ex.: `h97b3e96a`)**:
   - Controles de ordem `▲`, `▼` e `Remover` (com confirmação).
   - Campos:
     - `nome` (`text`)
     - `qualificacao` (`text`, entra após o nome, placeholder `"ex.: 1º Tenente Bombeiro Militar"`)
     - `como_chamar` (`select`: `ao`, `à`, `ao senhor`, `à senhora`, `aos`, `às`)
     - `mocao` (`text`, `"ex.: 12/2026"`)
     - `proponente` (`text`), `tratamento_proponente` (`select`: `Vereador`, `Vereadora`), `partido_proponente` (`text`)
     - `obs` (`text`, `"Observações da operação"`, placeholder `"ex.: entra com o neto"`)
     - `feito` (`textarea`, `"O que essa pessoa fez (matéria-prima do texto)"`)
     - `texto_cerimonial` (`textarea`, `"Texto do cerimonial (o que você lê)"`)
     - `texto_mocao` (`textarea`, `"Texto da moção"`)
   - Mídias do card: grade de miniaturas (`thumb.php`) com `×` para excluir foto; quando há vídeo, `select` `"Como este vídeo entra na sessão"` (`"Com som — toca no botão Vídeo"` | `"Sem som — entra no meio das fotos"`), preview `<video>` + `Remover vídeo`; upload múltiplo (`Escolher arquivos` + `Enviar arquivos`) aceitando fotos, vídeo e o **PDF da moção** (extraindo o texto na hora).
5. **Abertura e encerramento**: Textareas `abertura` e `encerramento` + `Salvar tudo`.

---

## 4. Entregáveis, Modelos Gráficos e Coordenadas Exatas (`entregaveis.php`, `modelos.php`, `arte.php`)

### Entregáveis (`entregaveis.php`)
- **4 KPIs no topo**: `Homenageados com material (X de N)`, `Fotos recebidas`, `Vídeos e arquivos (X no Drive, Y no servidor)`, `Dias até o prazo (fecha DD/MM, véspera da sessão)`.
- **Ações em lote**: `Ajustar modelos`, `PDF de todos os convites` (`arte.php?m=convite&s=...&lote=1&f=pdf&baixar=1`), `PDF de todos os certificados` (`arte.php?m=certificado&s=...&lote=1&f=pdf&baixar=1`).
- **Convite ao vereador proponente**: Um card por gabinete com input `Enviar para (separe por vírgula)` (pré-preenchido com o e-mail do gabinete) e botão `Enviar convite e link` — envia o convite individual do homenageado em anexo + o link exclusivo `enviar.php?t=<token>` (sem anexar o certificado).
- **Cards por homenageado**: Preview e download individual (`PNG` e `PDF`) do Convite e do Certificado + acordeão `Ajustar texto só deste certificado` com override de 3 campos (`artigo`, `nome_completo`, `texto_concessao`).

### Editor de Modelos (`modelos.php`) e Motor `arte.php`
- **Formatos de papel PDF**: `A4-paisagem` (`A4 deitado`), `A4-retrato` (`A4 em pé`), `A5-paisagem` (`A5 deitado`), `A5-retrato` (`A5 em pé`).
- **Artes de fundo atuais**: `convite.png` (`1748×1240 px`), `certificado.png` (`2000×1414 px`).
- **10 Fontes embarcadas**: `Cinzel-Bold`, `Cinzel-Regular`, `GreatVibes-Regular`, `PTSerif-Bold`, `PTSerif-Regular`, `PlayfairDisplay-Bold`, `PlayfairDisplay-Regular`, `Poppins-Bold`, `Poppins-Regular`, `Poppins-SemiBold`.
- **Marcadores suportados**: `{nome}`, `{titulo}`, `{nome_completo}`, `{artigo}`, `{mocao}`, `{proponente}`, `{do_proponente}`, `{tratamento_proponente}`, `{partido_proponente}`, `{data_aprovacao}`, `{motivo}`, `{data_extenso}`, `{data}`, `{hora}`, `{hora_extenso}`, `{presidente}`, `{casa}`, `{municipio}`, `{mocao_pdf}`, `{lista_destaque}`. Formatação inline: `**negrito**` e `##cor de destaque##`.
- **Propriedades de cada bloco `c[i]`**: `rotulo`, `texto`, `x` (0..1), `y` (0..1), `largura` (0..1), `tamanho` (fração da altura), `entrelinha`, `fonte`, `align` (`center`|`left`|`right`), `ancora` (`topo`|`meio`), `cor`, `cor_destaque`, `max_linhas`, `maiusculas` (bool), `encolher` (bool), `qr` (texto/marcador para gerar QR Code), `icone` (`""`|`calendario`|`relogio`|`local`), `oculto` (bool).

#### Coordenadas Padrão — Aba 1: `convite` (`papel = A5-paisagem`)
- `c[0]` **Corpo do convite**: `"A Câmara Municipal de Itapoá tem a honra de convidá-los para a **Sessão Solene Mensal de Homenagens** em razão da Moção de Aplausos {artigo} ##**{nome_completo}**##."` | `x=0.5, y=0.505, larg=0.86, tam=0.032, entrelinha=1.25, PTSerif-Regular, center, ancora=meio, cor=#12263a, dest=#17568c, max=4, encolher=true`
- `c[1]` **Número da moção**: `"(Moção nº {mocao})"` | `x=0.5, y=0.61, larg=0.8, tam=0.03, PTSerif-Regular, center, topo, #12263a, max=1, encolher=true`
- `c[2]` **Ícone de data**: `icone=calendario` | `x=0.162, y=0.677, tam=0.042, #12263a`
- `c[3]` **Data**: `"{data_extenso}"` | `x=0.205, y=0.66, larg=0.7, tam=0.028, left, topo, #12263a, encolher=true`
- `c[4]` **Ícone de hora**: `icone=relogio` | `x=0.165, y=0.73, tam=0.048, #12263a`
- `c[5]` **Hora**: `"{hora_extenso}"` | `x=0.205, y=0.704, larg=0.7, tam=0.028, left, topo, #12263a, encolher=true`
- `c[6]` **Ícone de local**: `icone=local` | `x=0.167, y=0.781, tam=0.048, #12263a`
- `c[7]` **Local**: `"Plenário da Câmara Municipal de Itapoá"` | `x=0.205, y=0.75, larg=0.72, tam=0.028, left, topo, #12263a`
- `c[8]` **Endereço**: `"Rua 960, R. 960 Mariana Michels Borges, 1115 - Itapema do Norte, Itapoá - SC, 89360-730"` | `x=0.205, y=0.773, larg=0.72, tam=0.016, left, topo, #12263a`
- `c[9]` **Presidente**: `"**{presidente}**\nPresidente"` | `x=0.5, y=0.862, larg=0.6, tam=0.029, entrelinha=1.3, center, topo, #12263a, max=2`

#### Coordenadas Padrão — Aba 2: `certificado` (`papel = A4-paisagem`)
- `c[0]` **Conectivo antes do nome**: `"{artigo}"` | `x=0.5, y=0.412, larg=0.5, tam=0.023, PTSerif-Regular, center, topo, #1b2f6b, maiusculas=true, max=1`
- `c[1]` **Nome do homenageado**: `"{nome_completo}"` | `x=0.5, y=0.478, larg=0.75, tam=0.047, PTSerif-Bold, center, meio, #1b2f6b, maiusculas=true, encolher=true, max=1`
- `c[2]` **Texto da concessão**: `"Por propositura {do_proponente} **{tratamento_proponente} {proponente}**, e coautoria de demais vereadores, a Moção n. {mocao} aprovada em plenário em {data_aprovacao}, {motivo}."` | `x=0.5, y=0.64, larg=0.75, tam=0.023, entrelinha=1.45, Poppins-Regular, center, meio, #1b2f6b, maiusculas=true, encolher=true, max=5`
- `c[3]` **QR Code da moção no SAPL**: `qr="{mocao_pdf}"` | `x=0.65, y=0.86, larg=0.2, tam=0.115, #1b2f6b`

#### Coordenadas Padrão — Aba 3: `convite_geral` (`papel = A5-paisagem`)
- Idêntico ao `convite`, exceto sem `Número da moção` e com `c[0]` = `"A Câmara Municipal de Itapoá tem a honra de convidá-los para a **Sessão Solene Mensal de Homenagens**, em que serão entregues as Moções de Aplausos a {lista_destaque}."` (`y=0.52, larg=0.85, tam=0.0315, max=8`) e ícones ajustados (`y=0.664`, `0.71`, `0.756`).

---

## 5. Contatos, Mídias, Pronunciamentos, Presença e Tablet

- **Contatos e Convite Geral (`contatos.php`)**:
  - Agendamento automático em duas datas: **sexta-feira que antecede a sessão** + **véspera da sessão** (com prefixo `LEMBRETE:` no assunto).
  - Opção `Enviar com cópia oculta` (BCC vs todos no `Para`), `Enviar convite aos marcados`, `Baixar a arte`, contador `X de 41 já receberam`.
  - 41 contatos divididos em 4 grupos: `Vereadores (10)` (exibe tag de licenciado quando inativo), `Assessoria parlamentar (11)`, `Servidores e setores (18)`, `Canais institucionais (2)` (`protocolo@` e `contato@`). Campos por linha: `nome`, `cargo`, `email`, `grupo`, `partido`, `obs`.
- **Mídias (`midias.php`) & Portal Público (`enviar.php?t=<token>`)**:
  - Prazo fecha na **véspera da sessão às 23:59**. `midias.php` exibe contagem em horas restantes, galeria de fotos recebidas (`/eventos/midia/<sessao>/<hid>/fotos/...`) e links de vídeos (`/video/...`).
  - `enviar.php?t=<token>` é enviado apenas no e-mail ao proponente (token nunca é listado na UI autenticada); sem token válido exibe mensagem amigável orientando copiar o link inteiro do e-mail.
- **Pronunciamentos (`pronunciamentos.php`)**:
  - Detecta automaticamente nomes coletivos (`"parece entidade ou grupo"`).
  - Por homenageado: radio `Vai usar a palavra?` (`Sim, vai falar` | `Não vai falar` | `Ainda não sei`), `Quem recebe e fala` (`text`) e `Cargo ou relação` (`text`).
- **Presença (`presenca.php`)**:
  - `presidente` (`select`), grid de checkboxes `presente[]` (`Marcar todos`/`Desmarcar todos`), `autoridades` (`textarea`). Se a abertura já existia com outra mesa, exibe aviso e checkbox `atualizar a abertura com a mesa de agora ao salvar`.
- **Tablet do Presidente (`tablet.php`)**:
  - Sincroniza de forma idempotente (ignora itens com mesmo título já criados) a sessão `Sessão Solene Mensal de Homenagens - DD/MM/AAAA` no sistema de pauta (`camara.itapoa.digital/pauta/`, substituído pelo novo `PautaOnline` em `pauta.camaraitapoa.sc.gov.br`) com **3 itens editáveis**:
    1. `Abertura Oficial`
    2. `Pronunciamento Presidencia` (inclui parágrafo automático resumindo o motivo de cada homenageado)
    3. `Encerramento`

---

## 6. Motor do Cerimonial Completo (`textos-cerimonial.php`, `documento.php`, `cerimonial.php`)

- **Cabeçalho de `documento.php`**: Exibe `X moção(ões) · Y caracteres · leitura estimada em Z minutos` (~895 chars/min) e botões `Imprimir / salvar em PDF`, `Copiar tudo`, `Baixar em .txt`, `Abrir no tablet` (`cerimonial.php`).
- **Estrutura Completa dos Blocos**:
  - **Bloco `_abertura`**:
    - `1. ABERTURA` (acolhimento regimental + lista numerada `Moção de Aplausos nº X/AAAA (Proponente) ao/à Homenageado`)
    - `2. FORMAÇÃO DA MESA` (`Presidente` + lista dos demais vereadores marcados como `presente`)
    - `3. PALAVRA DO PRESIDENTE` (fala oficial de abertura do Presidente)
    - `4. MENÇÃO DAS AUTORIDADES` (texto fixo + autoridades listadas)
  - **Blocos `5..N` (um por Homenageado, `data-hid="h..."`)**:
    - `{n}. MOÇÃO Nº {mocao} — {nome}`
    - `{n}.1 LEITURA DA MOÇÃO   ← telão: fotos do homenageado` (texto limpo da moção sem carimbos ICP-Brasil/assinaturas)
    - `{n}.2 VÍDEO` → se houver vídeo com áudio: `Assistam. (exibição do vídeo — áudio aberto na mesa)`; se não houver: `(sem vídeo nesta moção)`
    - `{n}.3 PALAVRA DO VEREADOR PROPONENTE   ← telão: placa` → `Concedo a palavra ao/à {tratamento} {proponente} ({partido}), autor(a) desta Moção de Aplausos e Reconhecimento.`
    - `{n}.4 ENTREGA DA MOÇÃO   ← telão: placa · trilha de fundo` → `O Poder Legislativo de Itapoá confere a Moção de Aplausos nº {mocao} {como_chamar} {nome}. Convidamos agora para vir à frente para proceder a entrega, o/a {tratamento} {proponente} ({partido}). Uma salva de palmas!`
    - `{n}.5 FOTOS   ← telão: placa` → `Agora, convido todos os vereadores e {como_chamar} {nome} a se posicionarem à frente para uma foto oficial.`
    - `{n}.6 PRONUNCIAMENTO DO HOMENAGEADO` → `Neste momento, convido {representante_e_cargo} para fazer o uso da palavra.` (omitido/ajustado se marcado `Não vai falar`).
  - **Bloco `_encerramento`**:
    - `PRONUNCIAMENTOS`: Filtra e lista **somente os vereadores presentes que NÃO propuseram moção na sessão**, seguido do discurso geral do Presidente mencionando todos os homenageados;
    - `CONSIDERAÇÕES FINAIS (Mestre de Cerimônias)` (agradecimento ao Presidente + síntese das moções entregues);
    - `TRANSIÇÃO PARA O ENCERRAMENTO OFICIAL` (passagem de palavra do Mestre de Cerimônias + fala final do Presidente encerrando a sessão).
- **Leitor Ao Vivo (`cerimonial.php`)**: Topbar fixa com título, status `#agora` (`Aguardando início` ou etapa atual vinda de `api.php?a=estado`), controles `A−`, `A+` e toggle `Seguir: ON` (rola automaticamente para o bloco `data-hid` acionado pela TI).

---

## 7. Operação de TI Ao Vivo (`controle.php`) e Palco 16:9 (`telao.php`)

### Console de TI (`controle.php`)
- **Barra de status**: Indicador de conexão com o telão (`#ponto-telao`, `#txt-telao`, `#status-agora`), botões `Abrir telão`, `Placa de abertura` (`data-etapa="abertura"`), `Tela preta` (`data-acao="preto"`), link `Montagem`.
- **Linha por homenageado (`data-hid`)**: Mostra nº, nome, moção, proponente, total de fotos/vídeo e 4 botões de etapa (`data-etapa`):
  1. `Título — abre o ciclo` (`titulo`)
  2. `Fotos — durante a leitura` (`fotos`, desabilitado `.off` se 0 fotos)
  3. `Vídeo — com áudio / anexar no telão (L)` (`video`)
  4. `Placa — fala · entrega · foto` (`placa`)
- **Painel Slideshow**: `◀ Foto` (`foto_anterior`), `Pausar` (`slide_pausar`), `Seguir` (`slide_seguir`), `Foto ▶` (`foto_proxima`), range `#intervalo` (`Tempo por foto`, padrão `6s`), `Mostrar GC` (`gc_ligar`), `Ocultar GC` (`gc_desligar`), select `#gcpos` (`inferior` = Inferior centralizado | `superior` = Superior direito).
- **Painel Vídeo**: `▶ Play` (`video_seguir`), `❚❚ Pausar` (`video_pausar`), `↺ Reiniciar` (`video_reiniciar`), range `#volvideo` (`100%`). Regra automática: **ao terminar o vídeo, o telão volta sozinho para a Placa do homenageado**.
- **Painel Trilha da entrega**: Select `#trilha` (MP3 de `/midia/_trilhas/`), `▶ Tocar` (`#btn-trilha`, toca em loop), `Parar (fade)` (`trilha_parar`), range `#voltrilha` (padrão `25%`).
- **Encerramento**: Botão `Placa de encerramento` (`data-etapa="encerramento"`).

### Palco de Projeção (`telao.php`)
- **6 camadas (`.telao-camada`)**: `#camada-abertura`, `#camada-titulo`, `#camada-foto` (moldura elegante + barra GC com nome, qualificação, moção e proponente), `#camada-video`, `#camada-placa`, `#camada-encerramento`, além de overlay de tela preta (`B`).
- **Tela inicial `#setup` (`Preparo do telão`, tecla `L`)**:
  - Seletor `#arq-locais` (`<input type="file" multiple accept="video/*,image/*">`) para vincular vídeos pesados direto do disco local da máquina do projetor sem passar pela rede;
  - Tabela `#tab-status` de conferência de materiais por homenageado + pré-medição das dimensões das fotos (`#btn-pre`).
- **Atalhos de teclado no Telão**: `F` = tela cheia, `B` = tela preta, `L` = abrir/fechar setup local, `→` = próxima foto.
- **Sincronização**: Comunicação local imediata entre abas (`BroadcastChannel`/`localStorage`) + persistência em `/eventos/api.php?a=estado` (`{sessao, hid, etapa, indice, ts, deixa}`) para sincronizar dispositivos externos como o tablet do Mestre de Cerimônias.

---

## 8. Configurações Globais, Composição da Casa e Design Tokens (`configuracoes.php` e `app.css`)

### Os 6 Cartões de `configuracoes.php`
1. **Chave da API do Google (Drive)**: `google_api_key` para ler pastas públicas (`"Qualquer pessoa com o link"`) na tela de montagem.
2. **Trilhas para a entrega**: Upload/remoção de arquivos MP3 instrumentais sem voz (`/eventos/midia/_trilhas/`).
3. **Composição da Casa**: Tabela editável de vereadores (`nome`, `tratamento` [`Vereador`|`Vereadora`], `partido`, `cargo`, `ordem` [`1` Presidente, `2` Vice, `3–4` Secretários, `10/99` demais], `email` do gabinete, `whatsapp`, checkbox `ativo` = Em exercício). Linha em branco no rodapé adiciona; apagar o nome remove.
   - *Composição atual (10 vereadores)*: Márcio José Puglia de Melo (PSD, Presidente), Daniel Silvano Weber (União Brasil, 1º Secretário), Odinei da Silva (MDB, 2º Secretário), Ademar Ribas do Valle Filho (MDB), Diego Ângelo Antunes (PL), Jéssica Lana Lemonie (PL), Marta Ferreira da Luz (PL), Valdecir Antônio Luiz da Silva (Avante), Ivan Pinto da Luz (MDB, licenciado), Wagner Gomes de Souza (PSD, licenciado).
4. **Conta Google da Casa**: OAuth persistente (`eventos@camaraitapoa.sc.gov.br`) usado pelos envios agendados (mesmo com sistema fechado) e por quem loga com senha compartilhada. Campos: teste de envio, `remetente_nome`, `responder_para`, `copia_para` (BCC de auditoria), janela automática `envio_hora_inicio` (`8`h) às `envio_hora_fim` (`19`h) e `hora_lembretes` (`9`h) — governa convite automático, cobrança de mídia por e-mail e **cobrança automática via WhatsApp quando faltam <= 2 dias para a sessão**.
5. **Quem entra no painel**: `dominios_login` (`camaraitapoa.sc.gov.br`) + listagem de contas Google já autenticadas com último acesso e botão `Remover`.
6. **Senha de acesso**: Troca da senha compartilhada (`atual`, `nova` mín. 8 caracteres).

### Design Tokens Originais (`app.css` e `login.php`)
- **Painel Admin**: `--bg: #f4f6fa`, `--bg2: #ffffff`, `--bg3: #eef1f7`, `--linha: #dde3ec`, `--texto: #151a22`, `--fraco: #5f6b7e`, `--azul: #1f5fe0`, `--azul2: #164bb5`, `--verde: #12904a`, `--ambar: #b45309`, `--vermelho: #c62828`, `--dourado: #9a7a1f`.
- **Login**: `--azul: #123f6b`, `--azul-claro: #1e5a99`, `--ouro: #b8912f`, `--tinta: #12263a`.
- **Telão Solene**: `--tel-papel: #f6f3ec`, `--tel-papel2: #efe9dd`, `--tel-tinta: #1b2230`, `--tel-tinta2: #4a5568`, `--tel-ouro: #94711c`, `--tel-ouro2: #c9a24a`, `--tel-azul: #16357e`, `--tel-azul2: #0f2559`.
