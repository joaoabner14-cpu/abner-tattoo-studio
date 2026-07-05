# Abner Tattoo Studio — Cloudflare

Nova implementação do projeto para Cloudflare Workers + Static Assets + D1. O projeto PHP original permanece intacto.

## Pré-requisitos

- Node.js 20 ou superior
- Conta Cloudflare
- Wrangler autenticado (`npx wrangler login`)

## Desenvolvimento local

```bash
npm install
npm run db:local
npm run dev
```

O Wrangler exibirá o endereço local. O banco local fica isolado dentro de `.wrangler/`.

## Publicação

1. Crie o D1:

```bash
npx wrangler d1 create tattoo-db
```

2. Copie o `database_id` retornado para `wrangler.jsonc`.
3. Crie as tabelas e publique:

```bash
npm run db:remote
npm run deploy
```

## Estrutura

- `public/`: aplicação web responsiva e assets
- `src/worker.js`: API HTTP executada no edge
- `migrations/`: estrutura versionada do banco D1
- `wrangler.jsonc`: configuração Cloudflare

## Migração dos dados existentes

O esquema D1 cobre as tabelas usadas pelo projeto atual: clientes, agendamentos, ordens de serviço, financeiro, movimentos, ajustes, crediário e caixa. Os dados MySQL não são copiados automaticamente; exporte-os como SQL/CSV, adapte datas e importe com `wrangler d1 execute`. Antes de importar, preserve os IDs e respeite a ordem das chaves estrangeiras indicada em `0001_schema.sql`.
