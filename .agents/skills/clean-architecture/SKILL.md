---
name: clean-architecture
description: >-
  Modular architecture, database schema design, SSE + BroadcastChannel real-time sync, chunked large
  video uploads behind Cloudflare, authentication, Controle Interno audit logging, and VPS deployment
  standards for Eventos (SSMH). Activate when structuring backend, APIs, state, or infrastructure.
---

# Clean Architecture, Tempo Real & Controle Interno — Eventos (SSMH)

## 1. Stack Recomendada (Alinhada ao Ecossistema da Câmara de Itapoá)
Para máxima sinergia com o **PautaOnline** já em produção na VPS da Câmara:
- **Fullstack**: **Next.js 15 (App Router)** + **TypeScript estrito** + **Tailwind CSS v4**
- **Banco de Dados**: **Prisma ORM** (PostgreSQL ou SQLite WAL em volume persistente, substituindo arquivos JSON soltos em disco do legado e evitando race conditions de auto-save simultâneo)
- **Motor Gráfico (PNG + PDF)**: Renderização determinística server-side de alta resolução (`@napi-rs/canvas` ou `sharp` + `pdf-lib`/`PDFKit` + `qrcode`) com as fontes `Poppins`, `PT Serif`, `Cinzel`, `Playfair Display` e `Great Vibes` embarcadas localmente
- **Extração de PDF**: `unpdf` / `pdfjs-dist` para extrair texto limpo dos PDFs oficiais de moções do SAPL

## 2. Organização Modular de Pastas
```text
src/
├── core/               # Regras puras (Art. 125-A, datas regimentais, template do cerimonial, parser de marcadores)
├── services/           # SAPL scraper, gerador PNG/PDF, Gmail OAuth2/SMTP, Google Drive, agendador, sync PautaOnline
├── app/
│   ├── (admin)/        # Painel autenticado (sessões, importar SAPL, montagem, entregáveis, modelos, contatos, config)
│   ├── (palco)/        # Operação ao vivo (controle, telão 16:9, cerimonial tablet)
│   ├── enviar/[token]/ # Portal externo público de upload por token
│   └── api/            # Route handlers validados com Zod + stream SSE + servidor de mídias com HTTP 206 Range
└── components/         # Design system institucional reutilizável
```

## 3. Evoluções Arquiteturais sobre Limitações do Legado
1. **Sincronia Ao Vivo Instantânea (Substituindo Polling)**:
   - Combinar `BroadcastChannel` (latência zero entre abas da mesma máquina de TI) + **Server-Sent Events (SSE)** (`/api/sessoes/[id]/stream`) para sincronizar `controle` ↔ `telao` ↔ `cerimonial` no tablet em `< 50ms` em qualquer dispositivo da rede do plenário.
2. **Upload de Vídeos Grandes sem Limite de 100 MB do Cloudflare**:
   - No legado, o Cloudflare bloqueava uploads `> 100 MB`, exigindo subir vídeos via painel do servidor e clicar em *"Procurar vídeos que subi pelo painel"*.
   - Na nova arquitetura, implementar **upload fatiado em chunks (ex.: fatias de 10 MB)** tanto no painel quanto no portal `/enviar/[token]`, além de manter o modo opcional de anexo de arquivo local (`URL.createObjectURL`) no `telao` para reprodução sem rede!
   - Servir vídeos e trilhas MP3 com suporte obrigatório a `Accept-Ranges: bytes` e `HTTP 206 Partial Content`.
3. **Gestão Completa do Ciclo de Vida da Sessão**:
   - Adicionar arquivamento/exclusão lógica segura de sessões de teste (ausente no `index.php` legado), protegida por confirmação e registro em auditoria.

## 4. Segurança e Controle Interno
- **Autenticação Dual Segura**:
  1. Login Google OAuth2 validando domínio autorizado (`@camaraitapoa.sc.gov.br`) e lista de contas permitidas, armazenando tokens OAuth criptografados (`AES-256-GCM`) no servidor;
  2. Senha compartilhada de operação armazenada com hash `scrypt`/`argon2` e proteção contra força bruta (rate limit) + proteção CSRF/SameSite.
- **Tokens do Portal `/enviar/[token]`**: Tokens aleatórios de alta entropia (`>= 128 bits`), vinculados a um único homenageado, com trava automática após o prazo (`véspera da sessão às 23:59:59`, salvo reabertura explícita pelo operador) e validação estrita de MIME/extensão.
- **Trilha de Auditoria (`AuditLog`)**: Registrar `usuario`, `acao`, `entidade`, `entidadeId`, `detalhes`, `ip` e `criadoEm` em todas as operações críticas.
