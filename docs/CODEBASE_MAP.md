# Mapa Arquitetural do Repositório (`docs/CODEBASE_MAP.md`)

## Stack
- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4
- **ORM / Banco**: Prisma 6 + SQLite WAL (`prisma/eventos.db`)
- **Motor Gráfico**: `@napi-rs/canvas` + `pdf-lib` + `qrcode` + 10 fontes `.ttf` locais
- **Extração de PDF**: `unpdf`
- **Sincronia em Tempo Real**: `BroadcastChannel` + Server-Sent Events (SSE)

## Árvore Principal
```text
prisma/
├── schema.prisma                # 10 tabelas (Sessao, Homenageado, Vereador, ContatoCasa, ModeloArte, TrilhaAudio, UsuarioPainel, MocaoEntregueSapl, Configuracao, AuditLog)
└── seed.ts                      # Seed oficial da Câmara (10 vereadores, 41 contatos, 3 modelos gráficos)
scripts/
├── setup-assets.ts              # Baixa as 10 fontes TTF e gera fundos/trilha institucional padrão
└── set-admin-password.ts        # Utilitário CLI para troca de senha do painel
src/
├── core/
│   ├── regimento.ts             # Art. 125-A (última terça-feira, prazos véspera 23:59, hash de mesa)
│   └── cerimonial.ts            # Gerador determinístico de Abertura, Homenageados, Encerramento e Tablet Presidente
├── lib/
│   ├── prisma.ts                # Singleton Prisma + SQLite WAL
│   ├── crypto.ts                # Hash scrypt + criptografia AES-256-GCM + tokens seguros
│   ├── auth.ts                  # Sessão JWT HttpOnly + AuditLog
│   ├── sse.ts                   # Pub/Sub em memória para SSE do Palco e Leitor
│   └── chunked-upload.ts        # Cliente de upload fatiado (8 MB/chunk) contornando limite Cloudflare
├── services/
│   ├── sapl.service.ts          # Fila assíncrona de Moções do SAPL (4 categorias) + limpeza de PDF
│   ├── arte.service.ts          # Renderizador posicional PNG e PDF individual/lote + QR Code
│   ├── comunicacao.service.ts   # Gmail REST API OAuth2 / SMTP + sincronia Google Drive
│   └── pauta-tablet.service.ts  # Integração transacional direta com PautaOnline (node:sqlite)
└── app/
    ├── page.tsx                 # Lista de sessões, arquivar/excluir, SAPL e criação manual
    ├── login/page.tsx           # Login Dual (Google OAuth @camaraitapoa + senha do painel)
    ├── importar/page.tsx        # Assistente SAPL (progresso 0–100% + 4 filas)
    ├── modelos/page.tsx         # Editor visual split-screen (Convite, Certificado e Convite Geral)
    ├── contatos/page.tsx        # 41 Contatos da Casa + disparo do Convite Geral com BCC
    ├── configuracoes/page.tsx   # 6 cartões de configuração global
    ├── auditoria/page.tsx       # Trilha de auditoria do Controle Interno
    ├── enviar/[token]/page.tsx  # Portal público mobile-first de envio de fotos/vídeos
    ├── sessoes/[id]/
    │   ├── page.tsx             # Hub de montagem + Checklist de 12 etapas + Auto-Save
    │   ├── entregaveis/page.tsx # Convites, certificados, override pontual e e-mail ao gabinete
    │   ├── midias/page.tsx      # Conferência de mídias + liberação excepcional +24h
    │   ├── pronunciamentos/     # Confirmação de fala e representantes
    │   ├── presenca/page.tsx    # Presença plenária + atualização seletiva da abertura
    │   ├── textos-cerimonial/   # Editor dedicado dos blocos do cerimonial
    │   ├── documento/page.tsx   # Cerimonial compilado para impressão/PDF e .txt
    │   ├── tablet/page.tsx      # Sincronia idempotente com Tablet do Presidente (PautaOnline)
    │   ├── cerimonial/page.tsx  # Leitor ao vivo do Mestre de Cerimônias (Seguir: ON)
    │   ├── controle/page.tsx    # Console de Operação de TI ao vivo
    │   └── telao/page.tsx       # Palco 16:9 solene (6 camadas + GC + anexo de vídeo local)
    └── api/                     # Endpoints REST + SSE + servidor de mídia HTTP 206 Range
```
