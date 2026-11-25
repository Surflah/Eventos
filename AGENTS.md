# Eventos (SSMH) — Diretrizes do Agente (Câmara Municipal de Itapoá)

Este arquivo define as regras permanentes do projeto **Eventos / Sessão Solene de Homenagens (SSMH)** para garantir máxima organização arquitetural, excelência visual (UI/UX), fidelidade regimental e economia rigorosa de tokens em todos os prompts.

## 1. Memória Exclusiva e Economia de Tokens
- **Consulta Obrigatória ao Iniciar**: Antes de planejar ou editar qualquer código, ative a skill `eventos-memory` e leia [`.agents/memory/PROJECT_STATE.md`](.agents/memory/PROJECT_STATE.md) para carregar o estado atual, stack definida e próximos passos.
- **Especificação Completa do Sistema Legado**: Jamais refaça exploração no navegador de `camara.itapoa.digital/eventos/` sem necessidade explícita. Todo o funcionamento, telas, campos, coordenadas de artes, textos de cerimonial e regras de negócio já estão documentados em [`.agents/memory/LEGACY_SYSTEM_SPEC.md`](.agents/memory/LEGACY_SYSTEM_SPEC.md). Leia apenas as seções necessárias com `StartLine`/`EndLine`.
- **Decisões Arquiteturais**: Consulte e atualize [`.agents/memory/DECISIONS.md`](.agents/memory/DECISIONS.md) sempre que tomar decisões de stack, banco de dados, autenticação, integrações ou deploy.

## 2. Uso de Skills Modulares (Progressive Disclosure)
Ative sob demanda as skills do projeto em `.agents/skills/` (além das skills globais do Antigravity, como `modern-web-guidance` para padrões modernos de HTML/CSS/DOM):
- `eventos-memory`: **Exclusiva para gestão da memória persistente** (`.agents/memory/PROJECT_STATE.md`, `DECISIONS.md` e `LEGACY_SYSTEM_SPEC.md`). Usar no início e no fechamento de cada entrega.
- `token-economy`: Protocolos Headroom de compressão de contexto, leitura cirúrgica por linhas, poda de logs de terminal e manutenção do `docs/CODEBASE_MAP.md`.
- `frontend-excellence`: Diretrizes visuais para os 3 ambientes do sistema (Painel Administrativo & Checklist, Palco 16:9 do Telão + Console de TI + Tablet do Mestre de Cerimônias, Portal Público Mobile de Upload e Editor Visual de Artes).
- `clean-architecture`: Estruturação em camadas limpas, tipagem estrita, sincronia ao vivo via SSE + `BroadcastChannel`, upload de vídeos grandes em chunks (contornando limite de 100 MB do Cloudflare), segurança e trilha de auditoria (`AuditLog`) para o Controle Interno.
- `ssmh-domain-and-integrations`: Regras regimentais (Art. 125-A do Regimento Interno), importação de Moções do SAPL (`sapl.itapoa.sc.leg.br`), gerador determinístico do Cerimonial, motor gráfico PNG/PDF (Convites e Certificados), envio OAuth2 Gmail/WhatsApp e integração com o Tablet do Presidente (`PautaOnline`).

## 3. Padrões de Engenharia, Segurança e Controle Interno
- **Modularidade Estrita**: Evitar arquivos monolíticos que misturem SQL/JSON, regra de negócio e UI. Manter responsabilidades separadas em `core/`, `services/`, `api/` e `components/`.
- **Segurança de Credenciais**: Chaves Google Cloud/Drive, credenciais OAuth2, tokens de WhatsApp e hashes de senha (`scrypt`/`argon2`) devem ficar estritamente no servidor (`.env` ou criptografados no banco), nunca expostos no HTML/JS cliente.
- **Auditoria Completa**: Registrar em `AuditLog` toda criação/edição/exclusão de sessão ou homenageado, disparo de convites, upload/remoção de mídias e alterações de configurações.
- **Pronto para VPS**: Manter configuração limpa para deploy em Linux/Nginx + SSL Let's Encrypt (mesmo padrão de infraestrutura do `PautaOnline` da Câmara).
