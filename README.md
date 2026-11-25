# Eventos / Sessão Solene de Homenagens (SSMH) — Câmara Municipal de Itapoá

Sistema completo para gestão regimental, gráfica e operação de plenário ao vivo das **Sessões Solenes Mensais de Homenagens (Art. 125-A do Regimento Interno)** da Câmara Municipal de Itapoá/SC.

## Principais Módulos
- **Integração Direta com o SAPL (`sapl.itapoa.sc.leg.br`)**: Triagem automática de Moções aprovadas, extração limpa do texto oficial em PDF (sem carimbos digitais) e cruzamento com a Composição da Casa.
- **Checklist Guiado de 12 Etapas & Auto-Save**: Acompanhamento integral do pré-evento ao plenário.
- **Motor Gráfico Posicional (PNG & PDF)**: Editor visual com 18 marcadores dinâmicos, QR Code do SAPL e exportação individual ou em lote de **Convites**, **Certificados da Moção** e **Convite Geral**.
- **Portal Externo Mobile (`/enviar/[token]`)**: Link exclusivo por homenagem com upload em fatias (suporta vídeos pesados `> 100 MB` sem bloqueio do Cloudflare) e fechamento automático na véspera às 23:59.
- **Cerimonial Determinístico & Integração `PautaOnline`**: Geração completa do roteiro, leitor para tablet do Mestre de Cerimônias (`Seguir: ON`) e sincronização idempotente das 3 falas no Tablet do Presidente (`pauta.camaraitapoa.sc.gov.br`).
- **Console de TI & Telão 16:9 Ao Vivo**: Sincronia instantânea via `BroadcastChannel` + SSE, slideshow com GC, trilha sonora com *fade-out* e reprodução de vídeos locais ou em rede (`HTTP 206`).

## Execução Local
```bash
npm install
npx prisma db push
npm run db:seed
npx tsx scripts/setup-assets.ts
npm run dev
```
