# Estado do Projeto — Eventos / Sessão Solene de Homenagens (SSMH)

## Status Atual
- **Fase**: **Fases 1 a 4 Concluídas e Implantadas** — Sistema completo em produção com todas as funcionalidades do sistema original mais evoluções arquiteturais (upload fatiado `> 100 MB`, sincronia SSE + `BroadcastChannel`, arquivamento/exclusão segura de sessões, integração direta `node:sqlite` com o `PautaOnline` e trilha de `AuditLog` para o Controle Interno).
- **Repositório GitHub**: `https://github.com/Surflah/Eventos`
- **Domínio de Produção**: `https://eventos.camaraitapoa.sc.gov.br` (VPS `177.153.60.71`, serviço `eventos.service` na porta `3007`, Nginx proxy reverso + SSL Let's Encrypt)
- **Portal Central**: Integrado em `https://sistemas.camaraitapoa.sc.gov.br/` (`/var/www/sistemas/index.html`)
- **Autenticação**:
  - Google OAuth2 institucional (`@camaraitapoa.sc.gov.br`) com envio por conta individual ou Conta Google da Casa;
  - Senha compartilhada inicial configurada com hash `scrypt` (alterável pela interface em `/configuracoes` ou via `ADMIN_PASSWORD='...' npm run admin:senha`).

## Roteiro de Implementação
- [x] **Fase 0**: Engenharia reversa integral (`camara.itapoa.digital/eventos/`), `AGENTS.md`, 5 skills modulares (`.agents/skills/`, incluindo `eventos-memory` exclusiva) e `LEGACY_SYSTEM_SPEC.md`.
- [x] **Fase 1**: Next.js 15 + TypeScript + Tailwind v4 + Prisma SQLite WAL, Login Dual, Configurações globais (6 cartões), seed dos 10 Vereadores e 41 Contatos da Casa, trilhas sonoras e `AuditLog`.
- [x] **Fase 2**: Fila assíncrona de Moções do SAPL (`sapl.itapoa.sc.leg.br`, 4 categorias + extração limpa de PDF via `unpdf`), Montagem da Sessão com Checklist de 12 itens, Auto-Save, Google Drive sync e Portal Público Mobile `/enviar/[token]` com upload em chunks `> 100 MB`.
- [x] **Fase 3**: Editor Visual de Modelos (`convite`, `certificado`, `convite_geral`), renderizador PNG/PDF individual e em lote (`@napi-rs/canvas` + `pdf-lib` + QR Code), disparo Gmail OAuth2/SMTP, Cerimonial Completo e sincronia direta com o Tablet do Presidente no `PautaOnline`.
- [x] **Fase 4**: Console de Operação de TI (`controle`), Palco 16:9 Solene (`telao` com 6 camadas, GC e vídeo local), Leitor do Tablet (`cerimonial` com `Seguir: ON`), deploy na VPS com SSL e inclusão no Portal Central `sistemas.camaraitapoa.sc.gov.br`.

## Próximo Passo Recomendado
Pronto para uso operacional e futuras customizações específicas solicitadas no dia a dia das Sessões Solenes.
