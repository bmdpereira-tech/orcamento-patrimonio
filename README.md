# Orçamento e património

Aplicação web pessoal para controlo mensal de orçamento, liquidez, cartões de crédito, investimentos e património líquido.

## Estado actual

Fase 2 em desenvolvimento:

- Next.js App Router, TypeScript, Tailwind CSS e Vitest configurados.
- Login single-user por palavra-passe com hash bcrypt e cookie `HttpOnly`.
- Layout protegido com navegação base.
- Migration Supabase/PostgreSQL com tabelas, constraints, índices, triggers `updated_at` e RLS sem acesso público.
- Contas carregadas e guardadas no Supabase.
- CRUD de contas com nome curto, tipo, ordem, visibilidade na tabela e inclusão em património líquido.
- Tabela mensal carregada do Supabase, com células editáveis e persistência em `account_month_states`, `budget_items` e `budget_allocations`.
- Net Assets calculado a partir das contas marcadas para património líquido e dos activos de investimento existentes.
- Seed inicial sem saldos pessoais.
- Helpers testáveis para meses e montantes em cêntimos.

## Requisitos

- Node.js 20 ou superior.
- Uma instância Supabase/PostgreSQL.
- npm.

## Configuração local

1. Instalar dependências:

```bash
npm install
```

2. Criar `.env` a partir de `.env.example`.

3. Gerar o hash da palavra-passe:

```bash
npm run auth:hash -- "a-sua-palavra-passe"
```

4. Gerar o segredo de sessão:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Configurar as variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
APP_PASSWORD_HASH=...
APP_SESSION_SECRET=...
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no browser. A aplicação usa Supabase apenas no servidor.

## Base de dados

Aplicar as migrations por ordem:

```text
supabase/migrations/20260701000000_initial_schema.sql
supabase/migrations/20260701001000_rename_t212_cash.sql
supabase/migrations/20260701002000_phase2_accounts_and_budget_lines.sql
```

Depois executar o seed:

```bash
npm run db:seed
```

O seed cria/actualiza apenas:

- Santander;
- CC Santander;
- ActivoBank;
- CC ActivoBank;
- T212 Cash;
- N26;
- IGCP;
- Trading 212 — Investimentos;
- primeiro mês disponível: 1 de Julho de 2026.

Não são inseridos saldos pessoais, salário, débitos directos, valorizações pessoais ou movimentos reais.

## Desenvolvimento

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
```

## Decisões técnicas

- Meses são representados como `YYYY-MM`; no PostgreSQL, como `date` sempre no primeiro dia do mês.
- Montantes são guardados e calculados em cêntimos inteiros.
- A interface usa `pt-PT`, EUR e valores negativos entre parênteses.
- O histórico começa em Julho de 2026; meses anteriores são normalizados para esse limite.
- Autenticação não usa email nem Supabase Auth.
- RLS fica activa com políticas que negam acesso a clientes anónimos; o servidor usa a service role.

## Próximas fases

1. Completar restantes operações funcionais da Fase 2, incluindo débitos recorrentes, regras mensais e histórico.
2. Criar a tab funcional de Investimentos com fundos, entregas, resgates, valorizações e cálculos.
3. Integrar automaticamente o valor mensal de Investimentos no orçamento e no cálculo de Net Assets.
4. Adicionar gráficos, smoke tests end-to-end e validação visual final.

## Publicação futura

A estrutura está preparada para GitHub, Vercel e Supabase, mas esta fase não publica nem faz push. Antes de publicar, configurar variáveis de ambiente no destino, rever as policies e executar a suite completa de verificação.
