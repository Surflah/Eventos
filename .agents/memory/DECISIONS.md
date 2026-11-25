# Registro de Decisões Arquiteturais (ADR) — Eventos (SSMH)

### [2026-11-25] ADR-001: Criação de Memória Persistente Exclusiva (`eventos-memory`) e Suíte Modular de Skills
- **Contexto**: Necessidade de manter memória fiel entre sessões sem misturar responsabilidades com economia de tokens ou regras de UI.
- **Decisão**: Isolar a gestão de memória na skill exclusiva `.agents/skills/eventos-memory/SKILL.md`, mantendo o estado vivo enxuto em `PROJECT_STATE.md` e toda a engenharia reversa em `LEGACY_SYSTEM_SPEC.md`.
- **Impacto**: Contexto limpo, sem re-explorações de navegador e consumo mínimo de tokens por prompt.

### [2026-11-25] ADR-002: Stack Next.js 15 + TypeScript + Tailwind v4 + Prisma SQLite WAL + `@napi-rs/canvas`
- **Contexto**: Unificação com a infraestrutura moderna já adotada no `PautaOnline` da Câmara Municipal de Itapoá.
- **Decisão**: Utilizar Next.js 15 App Router, Prisma 6 com SQLite em modo WAL, `@napi-rs/canvas` + `pdf-lib` + `qrcode` para artes gráficas fiéis em alta definição, `unpdf` para limpeza de PDFs do SAPL, SSE + `BroadcastChannel` para palco em tempo real e upload fatiado em chunks de 8 MB para contornar o limite de 100 MB do Cloudflare.
- **Impacto**: Paridade 100% com o sistema legado, eliminando seus gargalos operacionais e permitindo integração transacional direta (`node:sqlite`) com o banco do `PautaOnline` na mesma VPS.

### [2026-11-25] ADR-003: Infraestrutura de Produção na VPS da Câmara
- **Contexto**: Publicação oficial sob o domínio institucional `eventos.camaraitapoa.sc.gov.br` e listagem no portal unificado `sistemas.camaraitapoa.sc.gov.br`.
- **Decisão**: Hospedar em `/var/www/eventos` sob `eventos.service` (`systemd`, porta interna `3007`), Nginx proxy reverso com `proxy_buffering off` (para SSE instantâneo) e SSL Let's Encrypt gerenciado pelo Certbot.
- **Impacto**: Isolamento limpo entre os sistemas da VPS (`pauta` `3005`, `emendas` `3006`, `eventos` `3007`) e alta disponibilidade com reinício automático.
