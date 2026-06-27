# Orçamento e património

Aplicação web pessoal para controlo mensal de orçamento, liquidez, cartões de crédito, investimentos e património líquido.

## Estado actual

A Fase 2 está implementada e validada manualmente nas áreas principais:

- Orçamento mensal com saldos transportados, movimentos realizados, previsões, salário, débitos directos, Day to day, pagamentos de cartões e linhas personalizadas.
- Contas com criação, edição, arquivo, reactivação e eliminação segura.
- Débitos directos recorrentes com checklist mensal.
- Configurações versionadas de Day to day e salário/subsídios.
- Investimentos com activos, entregas, resgates, valorizações, métricas, rentabilidade simples e XIRR.
- Integração das valorizações de investimentos no Orçamento e no Património líquido.
- Histórico mensal com gráfico de liquidez/saldo e gráfico XIRR por investimento/global.
- Login single-user por palavra-passe com cookie `HttpOnly`.
- Supabase com RLS activa e acesso ao servidor via service role.

## Requisitos

- Node.js 20 ou superior.
- npm.
- Projecto Supabase.
- Vercel CLI opcional para publicação por linha de comando.

## Variáveis de ambiente

Criar `.env.local` a partir de `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
APP_PASSWORD_HASH=\$2a\$12\$replace-with-bcrypt-hash
APP_SESSION_SECRET=replace-with-at-least-32-random-characters
```

Gerar o hash da palavra-passe:

```bash
npm run auth:hash -- "a-sua-palavra-passe"
```

Gerar o segredo de sessão:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Notas de segurança:

- `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta no browser.
- Apenas `NEXT_PUBLIC_SUPABASE_URL` é pública.
- `.env`, `.env.local` e variantes locais estão ignorados pelo Git.
- Em ficheiros `.env` do Next.js, escapar os `$` do bcrypt como `\$`.

## Base de dados

As migrations versionadas estão em `supabase/migrations/`.

Validar e aplicar no Supabase:

```bash
npx supabase db push --dry-run
npx supabase db push
```

Executar seed inicial, se necessário:

```bash
npm run db:seed
```

O seed é idempotente e cria/actualiza apenas contas e configuração inicial, sem saldos pessoais, salário, débitos directos, valorizações pessoais ou movimentos reais.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Publicação GitHub + Vercel

1. Confirmar estado local:

```bash
git status
npm run lint
npm run typecheck
npm test
npm run build
npx supabase db push --dry-run
```

2. Enviar para GitHub:

```bash
git remote add origin https://github.com/USER/REPO.git
git push -u origin master
```

3. Importar o repositório no Vercel ou ligar por CLI:

```bash
npx vercel login
npx vercel link
```

4. Configurar no Vercel as variáveis:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_PASSWORD_HASH
APP_SESSION_SECRET
```

5. Publicar:

```bash
npx vercel deploy
npx vercel deploy --prod
```

Com a integração GitHub do Vercel activa, pushes para branches criam previews e o branch de produção configurado publica automaticamente.

## Decisões técnicas

- Meses são representados como `YYYY-MM`; no PostgreSQL, como `date` sempre no primeiro dia do mês.
- Montantes são guardados e calculados em cêntimos inteiros.
- A interface usa `pt-PT`, EUR e valores zero como `–`.
- Julho de 2026 é o primeiro mês disponível do Orçamento.
- Investimentos podem ter histórico anterior a Julho de 2026 para cálculo de rentabilidade e XIRR.
- Autenticação não usa email nem Supabase Auth.
- RLS fica activa com políticas que negam acesso a clientes anónimos; o servidor usa a service role.
