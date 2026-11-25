---
name: frontend-excellence
description: >-
  UI/UX design system, institutional visual identity, 16:9 live stage projection (Telão), IT operator
  console, ceremonial tablet reader, visual template editor, and mobile upload portal guidelines for
  Eventos (SSMH). Activate whenever creating or refining any screen or visual component.
---

# Frontend Excellence — Sistema de Eventos / SSMH (Câmara Municipal de Itapoá)

Antes de implementar componentes HTML/CSS/DOM complexos (modais `<dialog>`, popovers, tabelas responsivas, upload drag-and-drop, seletores de cor, tela cheia), consulte também a skill global **`modern-web-guidance`** para aplicar APIs web modernas e acessíveis.

## 1. Os 3 Universos Visuais do Sistema

### A. Painel Administrativo & Checklist Guiado (`/`, `/sessoes/[id]`, `/configuracoes`)
Estética institucional moderna, limpa, luminosa e autoexplicativa:
- **Paleta Administrativa**:
  - Superfícies: Fundo `--bg: #F4F6FA` | Cards `--bg-card: #FFFFFF` | Faixas sutis `--bg-muted: #EEF1F7` | Bordas `--border: #DDE3EC`
  - Tipografia: `Poppins` / `Plus Jakarta Sans` (`--text: #151A22`, `--text-muted: #5F6B7E`), `tabular-nums` em contadores e prazos.
  - Cores Institucionais: Azul Legislativo `--primary: #1F5FE0` (hover `#164BB5`), Azul Marinho Login `#123F6B`, Ouro Institucional `#B8912F` / `#9A7A1F`.
  - Semânticas: Sucesso `#12904A`, Alerta/Prazo `#B45309`, Perigo `#C62828`.
- **Padrões de UX**:
  - Raios suaves (`14px` em cards, `10px` em inputs/botões, `999px` em badges/pills) e sombra sutil `0 1px 2px rgba(16,24,40,.05), 0 4px 14px rgba(16,24,40,.06)`.
  - **Indicador de Auto-Save não intrusivo**: Badge discreto fixo (`"Salvamento automático ativo"` → `"Salvando..."` → `"Salvo às HH:MM"`).
  - **Checklist de 12 etapas sempre visível**: Barra de progresso visual separando claramente *"Antes da sessão (7)"* e *"No dia da sessão (5)"*, diferenciando itens automáticos de manuais.

### B. Operação Ao Vivo: Palco 16:9 (`telao`), Console de TI (`controle`) e Leitor (`cerimonial`)
1. **Palco de Projeção 16:9 (`telao`)**:
   - Estética clássica de **programa solene impresso**: Papel quente `--tel-papel: #F6F3EC` / `#EFE9DD`, Tinta grafite `#1B2230`, Ouro solene `#94711C` / `#C9A24A`, Azul Imperial `#16357E` / `#0F2559`.
   - `overflow: hidden` absoluto em `100vw x 100vh`, tipografia escalável em `vw`/`vh` para nitidez em projetores Full HD / 4K e transmissão OBS.
   - Transições cinematográficas suaves (`opacity` + `transform` com `cubic-bezier(0.22, 1, 0.36, 1)`) entre as 6 camadas (`abertura`, `titulo`, `fotos` com moldura inteligente retrato/paisagem + GC inferior ou superior direito, `video`, `placa`, `encerramento`) + `tela preta` imediata.
2. **Console de Operação de TI (`controle`)**:
   - Layout compacto estilo *switcher de broadcast*: indicador luminoso em tempo real da conexão com o Telão, botões grandes por homenageado (`Título`, `Fotos`, `Vídeo`, `Placa`) destacando a etapa ativa no ar, controles dedicados de slideshow/GC, player de vídeo e trilha MP3 com *fade-out* suave.
   - Atalhos de teclado visíveis (`F` tela cheia, `B` tela preta, `L` setup de mídia local, `←`/`→` fotos, `Espaço` pausar/seguir).
3. **Leitor Ao Vivo do Mestre de Cerimônias (`cerimonial`)**:
   - Ergonomia de tablet em plenário: alvos de toque `>= 48px`, controles fixos no topo (`A−`, `A+`, tema Claro/Escuro, `Seguir: ON/OFF`), destaque visual imediato do bloco em andamento sincronizado com o Console de TI e deixas visuais claras (`← telão: fotos`, `← telão: placa · trilha`).

### C. Portal Público de Mídias (`/enviar/[token]`) & Editor de Modelos (`modelos`)
- **Portal `/enviar/[token]`**: Mobile-first (usado por assessores e homenageados pelo celular), instruções acolhedoras, contador claro do prazo (véspera às 23:59), preview instantâneo das fotos enviadas, barra de progresso individual por arquivo e upload resiliente de vídeos grandes.
- **Editor de Modelos (`modelos`)**: Preview vivo lado a lado (split-screen) em proporção real A4/A5 enquanto o usuário ajusta blocos de texto, fontes clássicas (`Cinzel`, `Playfair Display`, `PT Serif`, `Great Vibes`, `Poppins`), cores, alinhamento, ícones e QR Code.
