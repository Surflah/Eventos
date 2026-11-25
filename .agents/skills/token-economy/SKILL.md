---
name: token-economy
description: >-
  Context compression, surgical file reading, terminal output pruning, and codebase atlas navigation
  (Headroom + Cartographer). Activate this skill throughout development to minimize token consumption
  while keeping reasoning fast and accurate.
---

# Token Economy — Compressão de Contexto & Atlas de Código

Esta skill aplica os protocolos **Headroom** (economia de tokens) e **Cartographer** (mapa estrutural do repositório) para que cada prompt consuma o mínimo possível de janela de contexto com máxima precisão.

## 1. Navegação Guiada por Mapa (`docs/CODEBASE_MAP.md`)
- Assim que o código-fonte do projeto for iniciado na Fase 1, mantenha o arquivo `docs/CODEBASE_MAP.md` atualizado com a árvore de diretórios, rotas principais, modelos do banco e serviços.
- Consulte `docs/CODEBASE_MAP.md` antes de fazer buscas amplas no repositório.

## 2. Leitura Cirúrgica de Arquivos
- **Nunca leia arquivos extensos inteiros sem necessidade**: Use buscas por símbolo/texto para descobrir a linha exata e depois `read_file` com `StartLine` e `EndLine`.
- **Consulta a `LEGACY_SYSTEM_SPEC.md`**: Leia primeiro o índice no topo do arquivo (linhas `1–45`) e depois carregue apenas o intervalo de linhas do módulo em implementação.

## 3. Contenção de Saída de Terminal
- Comandos ruidosos (`npm install`, `prisma migrate`, `next build`, testes longos, logs) devem ter saída filtrada (`| tail -n 35`, `--silent`, `--reporter=dot`) quando você só precisa confirmar sucesso ou capturar o erro final.
- Evite rodar `curl` ou inspeções repetitivas quando os dados já estiverem documentados.

## 4. Edições Atômicas e Respostas Enxutas
- Prefira `edit_file` em blocos localizados em vez de reescrever arquivos inteiros com `write_file`.
- Nas respostas ao usuário, não repita blocos grandes de código já salvos em disco: explique o que foi feito de forma direta e referencie com links clicáveis (`[arquivo.ts](file:///caminho/absoluto/arquivo.ts#L10-L30)`).
