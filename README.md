# Financeiro · Clados e Casa

PWA em Next.js para o financeiro da Clados (empresa) e da Casa. A única ponte entre os dois é a retirada.

## Rodar no Mac (modo demonstração)

```bash
npm install
npm run dev            # http://localhost:3000
```

Sem `DATABASE_URL`, o app sobe com um banco em memória já preenchido com as planilhas de setembro a novembro de 2026. Na tela de entrada, toque em **Matheus** ou **Dayane** (senha `clados2026`). Reiniciar o servidor volta os dados ao início.

Para abrir no iPhone na mesma rede Wi-Fi: `npm run dev -- -H 0.0.0.0` e acesse `http://<ip-do-mac>:3000`. Em Compartilhar › Adicionar à Tela de Início ele vira app.

## Testes

```bash
npm test               # regras, simulação de 3 meses, fluxo pelos serviços (51 testes)
npm run typecheck
# fluxo pela interface (precisa do Playwright e do servidor rodando):
node scripts/fluxo-ui.mjs http://localhost:3000
node scripts/telas.mjs http://localhost:3000 Matheus   # capturas em shots/
node scripts/velocidade.mjs http://localhost:3000 150  # tempo de cada toque com 150 ms de rede
```

## Produção

1. Criar o banco no Neon e pôr a URL em `DATABASE_URL`.
2. `npm run db:migrate` para criar as tabelas.
3. Na Vercel, definir `DATABASE_URL`, `BETTER_AUTH_SECRET` (aleatório) e `BETTER_AUTH_URL` (a URL do app).

## Onde está cada coisa

- `src/domain`: regras puras (fatura do cartão, meta de retirada, dízimo, fechamento, pode retirar).
- `src/server`: serviços que gravam no banco (`acoes.ts`) e montam cada tela; rotas da API em `rotas.ts` com Zod.
- `src/db`: schema Drizzle, dados da planilha (`planilha.ts`) e carga da demonstração (`seed.ts`).
- `src/app`: telas; `(abas)` têm a barra de baixo, `(acoes)` só para quem edita.
- Dinheiro é sempre inteiro em centavos.
