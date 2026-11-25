---
name: eventos-memory
description: >-
  Exclusive persistent cross-session memory skill for the Eventos / Sessão Solene de Homenagens (SSMH)
  project. Activate this skill at the start of every session or complex prompt to load current project
  state and past decisions, and at the end of every milestone to persist progress into .agents/memory/.
---

# Eventos-Memory — Memória Persistente Exclusiva do Projeto Eventos (SSMH)

Esta skill é **exclusiva para a gestão de memória de longo prazo** do sistema de **Eventos / Sessão Solene de Homenagens (SSMH)** da Câmara Municipal de Itapoá. Ela garante que o agente nunca perca contexto entre conversas, nunca precise re-explorar o sistema antigo e mantenha histórico rastreável de todas as decisões.

## Estrutura de Armazenamento (`.agents/memory/`)

1. [PROJECT_STATE.md](../../memory/PROJECT_STATE.md):
   - Resumo executivo vivo (máx. ~80 linhas): fase atual, stack escolhida, módulos/rotas prontos, variáveis de ambiente pendentes, credenciais de homologação/VPS (apenas referências seguras, sem segredos em texto puro) e próximo passo imediato.
2. [DECISIONS.md](../../memory/DECISIONS.md):
   - Registro histórico de decisões arquiteturais e de produto (formato ADR enxuto: Data, Contexto, Decisão e Impacto), incluindo melhorias solicitadas em relação ao sistema legado.
3. [LEGACY_SYSTEM_SPEC.md](../../memory/LEGACY_SYSTEM_SPEC.md):
   - Especificação técnica reversa 100% completa do sistema original (`https://camara.itapoa.digital/eventos/`), organizada por seções numeradas (autenticação, fluxos, checklist de 12 itens, SAPL, cerimonial, modelos gráficos com coordenadas exatas, console de TI, telão, contatos e configurações).

## Protocolo Obrigatório de Memória

### 1. Ao Iniciar Qualquer Sessão ou Tarefa
1. Leia integralmente [PROJECT_STATE.md](../../memory/PROJECT_STATE.md).
2. Caso a tarefa envolva arquitetura, banco de dados, autenticação, deploy ou mudança de regra de negócio em relação ao legado, leia [DECISIONS.md](../../memory/DECISIONS.md).
3. Caso a tarefa envolva implementar ou validar paridade com uma tela/módulo do sistema original, consulte **apenas a seção correspondente** de [LEGACY_SYSTEM_SPEC.md](../../memory/LEGACY_SYSTEM_SPEC.md).

### 2. Ao Concluir uma Funcionalidade ou Decisão
1. Atualize [PROJECT_STATE.md](../../memory/PROJECT_STATE.md):
   - Marque o checklist da fase/módulo concluído;
   - Registre novas rotas, tabelas Prisma, serviços ou integrações adicionadas;
   - Atualize o item "Próximo Passo Recomendado".
2. Se houve escolha técnica relevante ou mudança deliberada sobre o sistema original (pedida pelo usuário), adicione uma entrada datada em [DECISIONS.md](../../memory/DECISIONS.md):
   ```markdown
   ### [AAAA-MM-DD] Título da Decisão
   - **Contexto**: Por que a decisão surgiu.
   - **Decisão**: O que foi definido.
   - **Impacto**: Módulos afetados e consequências técnicas.
   ```

### 3. Regras de Ouro da Memória
- **Zero Segredos na Memória**: Nunca grave chaves privadas, client secrets OAuth, tokens de API ou senhas de VPS dentro de `.agents/memory/`. Registre apenas os nomes das variáveis (`.env.example`) e onde residem no servidor.
- **Alta Densidade de Sinal**: Mantenha `PROJECT_STATE.md` conciso e factual; detalhes extensos do legado permanecem isolados em `LEGACY_SYSTEM_SPEC.md`.
