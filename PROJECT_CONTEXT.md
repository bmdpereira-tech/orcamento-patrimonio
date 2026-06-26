# PROJECT_CONTEXT.md

> **Última actualização:** 26/06/2026
> **Projecto:** App Orçamento  
> **Pasta local:** `C:\Users\brunopereira\OneDrive - Ever You\Apps\Orçamento`

## 1. Finalidade deste ficheiro

Este ficheiro é a memória técnica e funcional permanente do projecto.

Deve ser lido pelo Codex antes de qualquer alteração relevante. Não substitui a análise do código: se existir diferença entre este documento e o estado real do repositório, o Codex deve inspeccionar o código, migrations e testes, identificar a discrepância, adoptar a solução menos destrutiva e actualizar este ficheiro no final.

Depois de cada fase importante, este documento deve ser actualizado e incluído num commit Git.

## 2. Objectivo da aplicação

Criar uma aplicação pessoal de controlo orçamental e patrimonial, inicialmente executada localmente no PC e, mais tarde, publicada através de GitHub, Vercel e Supabase.

A aplicação deve permitir acompanhar:

- liquidez por conta;
- orçamento mensal;
- movimentos realizados;
- previsões;
- débitos directos;
- pagamentos de cartões;
- despesas quotidianas;
- entradas e despesas extraordinárias;
- investimentos;
- património líquido.

Toda a interface deve usar português de Portugal.

## 3. Princípios de desenvolvimento

1. Trabalhar sempre sobre a aplicação existente.
2. Não criar uma aplicação paralela.
3. Não recriar o layout sem necessidade.
4. Preservar a interface já aprovada.
5. Não usar dados mockados como solução final.
6. Persistir os dados no Supabase.
7. Não efectuar migrations destrutivas sem autorização expressa.
8. Não apagar dados existentes.
9. Criar migrations SQL versionadas.
10. Centralizar cálculos em funções reutilizáveis.
11. Não duplicar fórmulas entre tabela, cartões e gráficos.
12. Criar ou actualizar testes para todas as regras financeiras.
13. Não avançar para uma fase posterior enquanto a fase actual não estiver validada.
14. Actualizar este ficheiro no final de cada alteração relevante.

## 4. Stack e estrutura conhecida

A aplicação utiliza actualmente:

- Next.js com App Router;
- TypeScript;
- Tailwind CSS;
- Supabase;
- Vitest;
- ESLint;
- Git local.

Áreas e ficheiros já identificados:

- `src/`
- `scripts/seed.ts`
- `supabase/migrations/`
- `src/components/app-shell.tsx`
- serviço `accounts.ts`
- serviço/cálculo `monthly-overview.ts`
- componente `account-management.tsx`
- páginas de Orçamento, Histórico, Contas, Débitos directos, Investimentos e Configurações.

Antes de alterar qualquer área, confirmar os caminhos exactos no código actual.

## 5. Git local

O projecto já tem Git inicializado localmente e existe pelo menos um commit criado após a primeira implementação funcional da Fase 2.

Boas práticas:

```powershell
git status
git add .
git commit -m "Descrição clara da alteração"
```

Criar um commit após cada fase funcional estável. Não é necessário publicar imediatamente no GitHub.

## 6. Supabase

### 6.1 Projecto remoto

Existe um projecto Supabase remoto chamado:

`orcamento-pessoal`

O projecto local já foi ligado ao Supabase através da CLI.

### 6.2 Variáveis de ambiente

O `.env.example` espera:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_PASSWORD_HASH=
APP_SESSION_SECRET=
```

Regras:

- o `.env.local` existe apenas localmente;
- o `.env.local` está ignorado pelo Git;
- nunca incluir segredos neste ficheiro;
- nunca incluir `SUPABASE_SERVICE_ROLE_KEY` no frontend;
- a `service_role` deve ser usada apenas em código executado no servidor;
- não mostrar o conteúdo do `.env.local` em capturas de ecrã ou respostas.

### 6.3 Autenticação actual

A aplicação usa actualmente uma password própria da app, baseada em:

- `APP_PASSWORD_HASH`;
- `APP_SESSION_SECRET`.

Não assumir que existe Supabase Auth sem confirmar no código.

## 7. Migrations existentes e aplicadas

As seguintes migrations foram criadas e aplicadas ao Supabase:

```text
20260701000000_initial_schema.sql
20260701001000_rename_t212_cash.sql
20260701002000_phase2_accounts_and_budget_lines.sql
```

A seguinte migration incremental foi criada no repositório em 25/06/2026 e deve ser aplicada ao Supabase antes de usar a tab Histórico em produção/local remoto:

```text
20260701003000_actual_movements.sql
```

Esta migration cria:

- tipo `actual_movement_type` com `income` e `expense`;
- tabela `actual_movements`;
- foreign key para `accounts`;
- montantes em cêntimos inteiros positivos;
- índices por conta/data e por data;
- trigger `updated_at`;
- RLS activa com policy `no_client_access`.

Decisão posterior: a aplicação **não exige nem usa activamente** o registo movimento a movimento. A tabela `actual_movements` permanece no schema por não se fazerem alterações destrutivas a migrations já executadas, mas está actualmente inactiva na aplicação.

Foi também criada a migration incremental:

```text
20260701004000_budget_items_sort_order.sql
```

Esta migration acrescenta `sort_order` a `budget_items` e cria um índice para ordenação de linhas por mês e origem. Serve as linhas personalizadas mensais da secção de previsões.

Foi também criada a migration incremental:

```text
20260701005000_recurring_rules_direct_debits.sql
```

Esta migration prepara `recurring_rules` para a tab Débitos directos:

- acrescenta `charge_day`;
- acrescenta `archived_at`;
- acrescenta `sort_order`;
- valida `charge_day` entre 1 e 31;
- valida novos montantes positivos;
- cria índices por conta, estado/mês e ordenação.

Esta migration deve ser aplicada ao Supabase antes de usar Débitos directos contra uma base de dados real.

Foi também criada a migration incremental:

```text
20260701006000_recurring_rule_month_states.sql
```

Esta migration cria `recurring_rule_month_states` para controlar, por mês, se uma ocorrência de débito directo fica excluída da previsão:

- `recurring_rule_id` com foreign key para `recurring_rules` e `on delete cascade`;
- `month_start` como primeiro dia do mês;
- `excluded_from_forecast`;
- unique constraint por `recurring_rule_id` e `month_start`;
- índices por mês e por regra;
- trigger `updated_at`;
- RLS activa com policy `no_client_access`.

Não são criados estados mensais antecipadamente. A ausência de registo significa `excluded_from_forecast = false`.

O bloco Day to day e Pagamentos de cartões, implementado em 25/06/2026, **não exigiu migration nova**. Foram reutilizadas estruturas já existentes no schema:

- `daily_budget_versions`;
- `credit_card_statement_overrides`;
- `accounts.linked_payment_account_id`.

Foi também criada a migration incremental:

```text
20260701007000_salary_versions_allow_subsidies.sql
```

Esta migration expande `salary_versions` para suportar a configuração versionada de salário:

- `vacation_bonus_cents`;
- `vacation_bonus_month`;
- `christmas_bonus_cents`;
- `christmas_bonus_month`;
- constraints para valores não negativos;
- constraints para meses válidos;
- constraint para impedir subsídio de férias e subsídio de Natal no mesmo mês.

Foram reutilizadas as estruturas existentes:

- `salary_versions` para configuração versionada;
- `salary_month_overrides` para o estado mensal de salário reflectido.

Nota posterior: `salary_month_overrides.amount_cents` e `salary_month_overrides.account_id` continuam no schema por compatibilidade e para evitar migrations destrutivas, mas deixaram de ser usados pelos cálculos e pela interface de Salário.

Foi também criada a migration incremental:

```text
20260701008000_account_month_realised_movements.sql
```

Esta migration acrescenta `realised_movements_override_cents` a `account_month_states`.

Decisão funcional associada:

- `Movimentos realizados` passou a ser o campo manual mensal por conta;
- `Saldo actual` passou a ser calculado automaticamente como `Saldo inicial + Movimentos realizados`;
- `current_balance_override_cents` permanece no schema por compatibilidade com dados antigos, mas deixou de ser a fonte de verdade nas novas gravações;
- dados antigos em `current_balance_override_cents` são interpretados como fallback quando `realised_movements_override_cents` ainda não existe para esse mês/conta.

Foi também criada a migration incremental:

```text
20260701009000_investment_cash_flows_and_valuations.sql
```

Esta migration implementa o primeiro bloco técnico de Investimentos:

- reutiliza `investment_assets`;
- cria o tipo `investment_cash_flow_type` com `contribution` e `redemption`;
- cria `investment_cash_flows` para entregas e resgates, com montantes positivos;
- cria `investment_valuations` para valorizações datadas, com valor de mercado em EUR/cêntimos;
- não altera `investment_month_values`, que permanece como estrutura legada;
- usa UUID, timestamps, índices, constraints, trigger `updated_at`, RLS e policy `no_client_access`.

Foi também criada a migration incremental:

```text
20260701010000_investment_assets_description.sql
```

Esta migration suporta o segundo bloco de Investimentos:

- acrescenta `description` opcional a `investment_assets`;
- mantém o campo nulo por omissão para compatibilidade com dados existentes;
- adiciona uma constraint não destrutiva para impedir descrições vazias quando preenchidas.

Foi também criada a migration incremental:

```text
20260701011000_investment_dates_before_budget_start.sql
```

Esta migration corrige a separação entre Orçamento e Investimentos:

- remove o limite mínimo de 2026-07-01 em `investment_cash_flows.flow_date`;
- remove o limite mínimo de 2026-07-01 em `investment_valuations.valuation_date`;
- relaxa `investment_assets.start_month` para permitir activos iniciados antes de Julho de 2026;
- mantém `start_month` e `archived_from_month` como datas de início de mês;
- mantém `archived_from_month >= start_month`;
- não altera a regra de Julho de 2026 nas tabelas e fluxos próprios do Orçamento.

Novas migrations devem:

- ter timestamp posterior à última migration versionada;
- ser versionadas no repositório;
- ser verificadas primeiro com `--dry-run`;
- não apagar dados;
- não recriar tabelas equivalentes sem necessidade.

Fluxo recomendado:

```powershell
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

## 8. Seed inicial

O seed inicial está em:

```text
scripts/seed.ts
```

O comando funcional é:

```powershell
npm.cmd run db:seed
```

O script `db:seed` foi actualizado para carregar explicitamente `.env.local` através de:

```text
tsx --env-file=.env.local scripts/seed.ts
```

Antes de alterar ou repetir o seed:

- confirmar que é idempotente;
- impedir duplicação de contas;
- não o executar automaticamente no arranque da aplicação.

## 9. Contas iniciais

Depois da execução do seed, a tabela mensal apresenta:

- Santander;
- CC Santander;
- ActivoBank;
- CC ActivoBank;
- T212 Cash;
- N26;
- IGCP.

`T212 Cash` é o nome curto aprovado para a conta de liquidez da Trading 212.

As contas devem ser dinâmicas, carregadas do Supabase, e não hardcoded.

## 10. Estado actual da Fase 2

### 10.1 Funcionalidades já implementadas ou parcialmente implementadas

Foi implementada uma primeira fatia funcional da Fase 2:

- contas carregadas do Supabase;
- tab Contas com criar, editar, arquivar, reactivar e eliminar quando permitido;
- contas com nome, nome curto, tipo, ordem, visibilidade e inclusão em Património líquido;
- tabela mensal carregada do Supabase;
- células manuais editáveis;
- persistência em estruturas como `account_month_states`, `budget_items` e `budget_allocations`;
- cálculo de Net Assets limitado às contas marcadas para inclusão;
- preservação geral do layout aprovado;
- `T212 Cash` mantido como nome curto.

Em 25/06/2026 foi corrigida a interpretação do primeiro bloco da Fase 2.

Regras agora implementadas:

- a aplicação não obriga ao registo de movimentos bancários individuais;
- `actual_movements` permanece no schema, mas não é fonte activa dos cálculos;
- `Movimentos realizados` é editável manualmente por conta e por mês;
- `Movimentos realizados` é persistido em `account_month_states.realised_movements_override_cents`;
- `Saldo actual` é automático e read-only;
- `Saldo actual = Saldo inicial + Movimentos realizados`;
- mês sem movimentos introduzidos usa `Movimentos realizados = 0` e `Saldo actual = Saldo inicial`;
- novas gravações deixam `account_month_states.current_balance_override_cents` a `null`;
- o transporte mensal continua a usar o saldo final do mês anterior como saldo inicial do mês seguinte;
- a tab Histórico mostra uma visão mensal agregada, não uma lista de transacções;
- o Histórico apresenta apenas meses anteriores ao mês actual, ordenados do mais recente para o mais antigo;
- `Variação de liquidez = saldos finais de contas de liquidez - saldos iniciais de contas de liquidez`;
- `Variação de investimentos = saldos finais de contas classificadas como investimento - saldos iniciais dessas contas`;
- linhas personalizadas mensais são suportadas em `budget_items`/`budget_allocations`;
- linhas personalizadas têm descrição, valores por conta, mês, ordem e eliminação;
- linhas personalizadas já não têm selector de tipo na tabela mensal;
- valores de linhas personalizadas são assinados por conta: positivo adiciona, negativo subtrai e zero não tem impacto;
- o total de cada linha personalizada é a soma algébrica dos valores por conta;
- novas linhas personalizadas são criadas imediatamente no servidor e usam o UUID definitivo devolvido pelo Supabase;
- a eliminação de linhas personalizadas usa apenas mês e UUID da linha, sem validar descrição, tipo ou valores;
- a gravação da tabela mensal passou a ser automática, com actualização local imediata, gravação ao sair do campo e debounce de cerca de 650 ms;
- a tabela mensal apresenta estado visual de gravação: `A guardar…`, `Guardado` e `Erro ao guardar`;
- zeros em visualização normal aparecem como `–`;
- a tabela mensal foi compactada verticalmente sem alterar a largura;
- a página Contas usa um contentor mais largo, semelhante ao do Orçamento.
- a tab Débitos directos foi transformada numa gestão funcional baseada em `recurring_rules`;
- débitos directos suportam criar, editar, activar/desactivar, arquivar, reactivar e eliminar apenas quando seguro;
- a edição de débitos directos existentes usa actualização local imediata, gravação automática com debounce e estado visual;
- a linha mensal `Débitos directos` é automática, negativa por conta e apenas de leitura;
- débitos directos activos, não arquivados e aplicáveis ao mês alimentam o orçamento mensal por conta;
- datas de cobrança 29/30/31 usam o último dia válido em meses mais curtos.
- qualquer conta activa pode receber débitos directos, incluindo cartões de crédito, contas de investimento, numerário e outros tipos;
- a validação de conta dos débitos directos não usa tipo de conta nem `includeInNetWorth`;
- contas arquivadas não aparecem para novas associações, mas regras antigas ligadas a uma conta entretanto arquivada continuam visíveis;
- o dia de cobrança é apenas informativo e não exclui automaticamente valores da previsão;
- o Orçamento mensal tem uma checklist `Débitos directos do mês`;
- checkbox desmarcada significa valor ainda previsto e incluído na linha `Débitos directos`;
- checkbox marcada significa excluído da previsão desse mês;
- o estado da checkbox é independente por combinação débito directo/mês;
- a linha `Débitos directos` soma apenas regras aplicáveis que não estejam excluídas no mês.

Validações técnicas reportadas pelo Codex:

- lint passou;
- typecheck passou;
- testes passaram;
- build passou.

Estas validações devem ser repetidas após novas alterações.

Nota da alteração de linhas personalizadas/autosave em 25/06/2026:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- `npm.cmd run build` passou;
- `npm.cmd test` não pôde ser repetido neste ambiente depois das últimas correcções porque o Vitest/esbuild foi bloqueado pelo sandbox ao resolver a configuração na pasta OneDrive e a tentativa com permissão elevada foi recusada por limite automático de uso;
- a validação em browser também ficou bloqueada porque o servidor local não permaneceu acessível em `127.0.0.1:3000` dentro do browser interno.

Nota da implementação de Débitos directos em 25/06/2026:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- testes focados de domínio, integração mensal e componente passaram;
- `npm.cmd test` completo passou com permissão elevada, necessária devido ao bloqueio do Vitest/esbuild no sandbox da pasta OneDrive;
- `npm.cmd run build` passou;
- `git diff --check` passou;
- a validação em browser foi apenas parcial: o servidor local foi alcançado em `127.0.0.1:3000`, mas `/debitos-directos` redireccionou para `/login`; o fluxo autenticado não foi validado no browser interno e o ambiente Codex registou falha de `fetch` ao carregar dados Supabase.

Nota da checklist mensal de Débitos directos em 25/06/2026:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- testes focados de domínio e componentes passaram com permissão elevada;
- `npm.cmd test` completo não pôde ser validado no ambiente Codex: no sandbox o Vitest/esbuild falhou com `Access denied` ao resolver `vitest.config.ts`, e a tentativa com permissão elevada foi recusada pelo revisor automático por limite de uso;
- `npm.cmd run build` passou;
- `git diff --check` passou;
- a validação em browser ficou pendente: o browser interno bloqueou a navegação para `127.0.0.1:3000`, e não foi tentado contorno.

Nota da correcção de eliminação definitiva de Débitos directos em 25/06/2026:

- causa diagnosticada: a eliminação apagava apenas `recurring_rules`, dependia exclusivamente do cascade da base de dados para estados mensais e não confirmava que a linha da regra tinha sido efectivamente apagada antes de devolver sucesso à UI;
- a migration `20260701006000_recurring_rule_month_states.sql` já define `recurring_rule_id` com `on delete cascade`, por isso não foi criada migration nova;
- `deleteRecurringRuleWhenAllowed` passou a apagar explicitamente `recurring_rule_month_states` da regra antes de apagar `recurring_rules`;
- a eliminação da regra passou a usar `delete().eq("id", id).select("id").single()` para confirmar a linha eliminada; erro ou ausência de confirmação devolve falha e mantém a regra visível na interface;
- a checklist mensal e os cálculos continuam a partir de regras existentes em `recurring_rules`; estados mensais órfãos são ignorados;
- foram adicionados testes para a sequência de eliminação no serviço, estados órfãos, cenário Setembro-Outubro de 2026 com Setembro excluído e Outubro incluído, eliminação local com sucesso/falha, revalidação de páginas e recálculo da tabela mensal;
- `vitest.config.ts` passou a mapear `server-only` para um stub de teste, permitindo testar serviços server-only sem alterar o runtime Next.js;
- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- testes focados passaram com permissão elevada, após bloqueio do sandbox ao carregar `vitest.config.ts`: 5 ficheiros e 44 testes;
- `npm.cmd test` completo passou com permissão elevada: 12 ficheiros e 79 testes;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados.

Nota de limpeza de dados no Supabase em 25/06/2026:

- foi removido um resíduo real da regra de débito directo `Teste` que ainda existia em `recurring_rules`, activa e não arquivada, com intervalo de Setembro a Outubro de 2026;
- a regra removida tinha o id `9ee9904e-514f-486a-955c-910dc7d60b01`;
- existia um estado mensal associado para Setembro de 2026 em `recurring_rule_month_states`, removido por cascade ao apagar a regra;
- não foram encontrados estados mensais órfãos depois da limpeza;
- não foram encontrados `budget_items` nem `budget_allocations` associados a `Teste`;
- não foram encontrados resíduos de `Teste` em estruturas antigas de overrides;
- não houve alteração de schema, migrations ou lógica funcional;
- depois da limpeza, Setembro e Outubro de 2026 apresentam apenas os débitos válidos restantes, `Luz rexaldia` e `Seguro Saúde`.

Nota da implementação Day to day e Pagamentos de cartões em 25/06/2026:

- a tab Configurações passou a permitir gravar versões de Day to day com plafond diário, conta e mês de entrada em vigor;
- as versões são persistidas em `daily_budget_versions`;
- para cada mês é usada a versão mais recente com `effective_from_month <= mês seleccionado`;
- a conta de Day to day pode ser qualquer conta activa, sem filtrar por tipo;
- contas arquivadas não ficam disponíveis para novas versões, mas versões antigas continuam legíveis;
- a linha `Day to day` no Orçamento é automática, negativa, apenas de leitura e aplicada só à conta configurada;
- mês passado calcula `0`;
- mês actual inclui o dia actual, em Europe/Lisbon, através de `dias_do_mês - dia_actual + 1`;
- mês futuro usa todos os dias do mês;
- valores antigos de `budget_items`/`budget_allocations` para `day_to_day` são ignorados pelos cálculos actuais;
- cartões de crédito usam `accounts.linked_payment_account_id` como conta de pagamento;
- a linha `Pagamentos de cartões` é automática e apenas de leitura;
- o pagamento automático de cada cartão é `max(0, -Saldo actual do cartão)`, antes de previsões futuras;
- a distribuição é uma transferência de soma zero: valor negativo na conta de pagamento e positivo no cartão;
- se faltar conta de pagamento válida, a UI mostra aviso no painel mensal e não calcula silenciosamente;
- overrides mensais de extracto são persistidos em `credit_card_statement_overrides`;
- override positivo ou zero substitui o automático; ausência de override usa automático; limpar o campo volta ao automático;
- os controlos mensais de cartões ficam em caixas compactas imediatamente por baixo da tabela mensal, não na coluna lateral dos Débitos directos;
- cada caixa de cartão mostra apenas nome do cartão, campo `Valor do extracto` e checkbox `Usar valor do extracto`;
- checkbox desmarcada significa ausência de override e usa o cálculo automático;
- checkbox marcada activa o campo, grava override mensal e permite valores positivos ou zero;
- os autosaves de extractos têm debounce, confirmação visual e protecção contra respostas fora de ordem;
- valores antigos de `budget_items`/`budget_allocations` para `credit_card_payments` são ignorados pelos cálculos actuais.

Validações técnicas deste bloco:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- testes focados de domínio, snapshots mensais e componente passaram com permissão elevada depois de o sandbox bloquear o Vitest/esbuild;
- `npm.cmd test` completo passou com permissão elevada: 14 ficheiros e 106 testes;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados;
- não foi criada migration nova;
- não foi criado commit.

Nota de ajuste de interface de Pagamentos de cartões em 25/06/2026:

- o painel `Pagamentos de cartões do mês` foi removido da coluna lateral;
- os cartões passaram para caixas compactas lado a lado por baixo da tabela mensal, com layout responsivo;
- cada caixa mostra apenas nome, campo `Valor do extracto` e checkbox `Usar valor do extracto`;
- a checkbox é agora o indicador explícito de existência de override mensal;
- desmarcar limpa o override e regressa imediatamente ao automático;
- marcar preenche inicialmente com o valor automático e deixa o campo editável;
- valores negativos são bloqueados na UI;
- a lógica Day to day não foi alterada;
- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados;
- a repetição dos testes Vitest ficou bloqueada no ambiente Codex: no sandbox falhou com `Access denied` ao resolver `vitest.config.ts`, e a tentativa com permissão elevada foi recusada por limite automático de uso.

Nota da implementação Salário em 26/06/2026:

- a tab Configurações passou a permitir gravar versões de salário com conta de recebimento, salário mensal normal, subsídio de férias, mês do subsídio de férias, subsídio de Natal, mês do subsídio de Natal e mês de entrada em vigor;
- a configuração é persistida em `salary_versions`;
- foi criada a migration `20260701007000_salary_versions_allow_subsidies.sql` porque `salary_versions` só tinha `amount_cents` e `account_id`, sem colunas para subsídios;
- para cada mês é usada a versão mais recente com `effective_from_month <= mês seleccionado`;
- o subsídio de férias ou de Natal substitui o salário normal no respectivo mês, não é somado;
- a linha `Salário` no Orçamento é automática, positiva, apenas de leitura e aplicada apenas à conta configurada;
- valores antigos de `budget_items`/`budget_allocations` com `source_type = 'salary'` são ignorados pelos cálculos actuais;
- a caixa `Salário do mês` foi acrescentada por baixo da tabela mensal;
- a checkbox `Já reflectido no saldo actual` grava estado mensal em `salary_month_overrides.status = 'received'` e faz a linha `Salário` passar a zero só nesse mês;
- desmarcar volta a `status = 'planned'` e repõe imediatamente o cálculo automático;
- o autosave do salário é independente do autosave geral da tabela e recalcula localmente antes da resposta do servidor.

Validações técnicas deste bloco:

- `npm.cmd run typecheck` passou;
- `npm.cmd test` falhou no sandbox com `Access is denied` ao resolver `vitest.config.ts`, mas passou com permissão elevada: 15 ficheiros e 120 testes;
- `npm.cmd run lint` passou;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados;
- `npx.cmd supabase db push --dry-run` passou e indicou que seria enviada apenas `20260701007000_salary_versions_allow_subsidies.sql`;
- não foi criado commit.

Nota de correcção final do bloco Salário em 26/06/2026:

- a interface mensal deixou de mostrar `Valor excepcional` e `Usar valor excepcional`;
- a aplicação deixou de usar `salary_month_overrides.amount_cents` e `salary_month_overrides.account_id` nos cálculos de Salário;
- `salary_month_overrides` fica apenas como estado mensal da checkbox `Já reflectido no saldo actual`;
- a caixa `Salário do mês` foi compactada para mostrar apenas título, valor previsto e checkbox;
- o aviso amarelo do primeiro mês foi removido da página de Orçamento;
- a regra interna de Julho de 2026 como primeiro mês mantém-se inalterada.

Nota da implementação da protecção de alterações históricas em 26/06/2026:

- foi criada uma função central de domínio para detectar impacto histórico em `Europe/Lisbon`;
- uma alteração exige confirmação quando o primeiro mês financeiramente afectado é anterior ao mês actual em Lisboa;
- a decisão devolve o primeiro mês afectado e a mensagem: `Esta alteração afecta [mês] e pode recalcular os saldos transportados dos meses seguintes. Pretende continuar?`;
- as Server Actions aceitam `confirmHistoricalImpact=true` e voltam a validar antes de gravar;
- sem confirmação, uma alteração histórica devolve resultado estruturado e não grava;
- foi criado um modal próprio de confirmação, sem `window.confirm`;
- o modal tem os botões `Cancelar` e `Aplicar alteração`;
- cancelar repõe o estado anterior nos fluxos com actualização local imediata e cancela autosaves pendentes;
- confirmar repete a operação com confirmação explícita;
- a tabela mensal compara valores financeiros persistidos antes de decidir se há impacto histórico, permitindo alterações apenas de descrição/ordem sem alerta;
- ficaram protegidos: Movimentos realizados em mês histórico, criação/eliminação/valores de linhas personalizadas, checklist mensal de Débitos directos, overrides de cartões, checkbox mensal de Salário, regras de Débitos directos com vigência/estado/montante/conta retroactivos, Configurações Day to day e Salário retroactivas, e alterações financeiras/arquivo/reactivação/eliminação de contas;
- alterações sem impacto financeiro, como nome/descrição/ordem visual, não disparam alerta;
- não foi criada migration nova.

Validações técnicas deste bloco:

- `npm.cmd run typecheck` passou;
- `npm.cmd run lint` passou;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados;
- `npm.cmd test` ficou bloqueado no sandbox pelo erro conhecido do Vitest/esbuild ao ler `vitest.config.ts` na pasta OneDrive (`Access is denied`);
- a repetição com permissão elevada foi recusada pelo revisor automático por limite de uso, por isso a suite completa deve ser repetida localmente no PC.

Nota da correcção da lógica central da tabela mensal em 26/06/2026:

- `Movimentos realizados` passou a ser editável pelo utilizador na tabela mensal;
- `Saldo actual` passou a ser automático e read-only;
- a fórmula central é `Saldo actual = Saldo inicial + Movimentos realizados`;
- meses futuros sem movimentos introduzidos mantêm `Movimentos realizados = 0` e `Saldo actual = Saldo inicial`;
- as previsões continuam a calcular normalmente o `Saldo final`, que é transportado para o mês seguinte;
- a persistência de novos movimentos usa `account_month_states.realised_movements_override_cents`;
- novas gravações limpam `account_month_states.current_balance_override_cents`, que fica apenas como fallback de compatibilidade;
- a protecção histórica foi adaptada para confirmar alterações a `Movimentos realizados` em meses passados;
- cancelar a confirmação histórica repõe o movimento anterior e cancela autosaves pendentes.

Validações técnicas desta correcção:

- `npm.cmd run typecheck` passou;
- `npm.cmd run lint` passou;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados;
- `npm.cmd test` voltou a ficar bloqueado no sandbox pelo erro conhecido do Vitest/esbuild ao ler `vitest.config.ts` na pasta OneDrive (`Access is denied`).

Nota da revisão integral da Fase 2 em 26/06/2026:

- foi revista a implementação actual de fórmulas mensais, previsões, estados mensais, autosave, protecção histórica, histórico, contas e resíduos de código antigo;
- `getMonthIdForDate` passou a derivar o mês em `Europe/Lisbon`, evitando diferenças quando o runtime usa outro fuso horário;
- a página Orçamento sem parâmetro `month` passou a abrir o mês actual em `Europe/Lisbon`; o atalho `Mês actual` também aponta para esse mês e não para Julho de 2026;
- foram removidos textos de UI obsoletos relacionados com o aviso amarelo do primeiro mês e botões/campos antigos já não renderizados;
- a persistência da tabela mensal deixou de conter código morto que tentava manter linhas automáticas antigas em `budget_items`; resíduos antigos com `source_type` automático continuam ignorados pelos cálculos;
- contas sem visibilidade financeira (`showInBudget = false` e `includeInNetWorth = false`) deixam de pedir confirmação histórica ao arquivar/reactivar/eliminar quando não afectam saldos;
- alterações de estado de Débitos directos que não mudam efectivamente o estado financeiro deixam de pedir confirmação histórica;
- não foi criada migration nova.

Validações técnicas desta revisão:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- `npm.cmd test` passou com permissão elevada: 20 ficheiros e 155 testes;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados.

Nota do primeiro bloco técnico de Investimentos em 26/06/2026:

- foi criado o domínio puro `src/domain/budget/investments.ts`;
- foram modelados fluxos de capital (`contribution` e `redemption`) e valorizações datadas;
- no domínio, entregas entram como fluxos negativos, resgates como fluxos positivos e a valorização terminal como fluxo positivo;
- são calculados por investimento e globalmente: total entregue, total resgatado, capital líquido investido, última valorização elegível, ganho/perda, rentabilidade simples e XIRR;
- a rentabilidade simples usa `ganho/perda ÷ total entregue` e devolve `null` quando o total entregue é zero;
- a XIRR usa dias reais/base 365, Newton-Raphson com fallback por bissecção e devolve `null` quando faltam fluxos suficientes ou não há solução matemática segura;
- a regra mensal passa a existir no domínio: o valor mensal de um activo é a última valorização com data igual ou anterior ao último dia do mês;
- valorizações futuras são excluídas e uma valorização mantém-se aplicável aos meses seguintes até surgir outra;
- `investment_cash` continua separado de activos: contas como `T212 Cash` não entram na valorização dos activos;
- não foram alterados a página de Investimentos, o Orçamento ou o Histórico.

Validações técnicas iniciais deste bloco:

- `npm.cmd run typecheck` passou;
- teste focado `npm.cmd test -- src/domain/budget/investments.test.ts` passou com permissão elevada: 1 ficheiro e 13 testes.

Nota do segundo bloco de Investimentos em 26/06/2026:

- foi criado o serviço server-only `src/server/budget/investments.ts`;
- a tab `Investimentos` passou a carregar dados reais do Supabase;
- a página usa `investment_assets`, `investment_cash_flows` e `investment_valuations`;
- é possível criar investimento, editar nome/descrição/ordem, arquivar, reactivar e eliminar apenas quando não existirem fluxos nem valorizações;
- é possível criar, editar e eliminar entregas, resgates e valorizações;
- entregas e resgates usam montantes introduzidos positivamente; o tipo define o sinal económico no domínio;
- valorizações aceitam valor de mercado em EUR/cêntimos e não permitem duplicação do mesmo investimento na mesma data através da constraint única da base de dados;
- a interface mostra resumo global, métricas por investimento, última valorização elegível e lista cronológica de fluxos/valorizações;
- métricas de Investimentos usam o domínio puro já criado: total entregue, total resgatado, capital líquido investido, valor de mercado, ganho/perda, rentabilidade simples e XIRR;
- datas futuras podem ser registadas e aparecem na lista, mas só entram nas métricas quando forem elegíveis pela data de referência;
- investimentos arquivados mantêm dados e métricas visíveis;
- alterações financeiras com data em mês passado passam pela protecção histórica existente;
- ainda não houve integração com Orçamento, Histórico ou Património.

Validações técnicas deste bloco:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- `npm.cmd test` passou com permissão elevada: 24 ficheiros e 189 testes;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados.

Nota da correcção de histórico anterior ao Orçamento em Investimentos em 26/06/2026:

- causa corrigida: o serviço `src/server/budget/investments.ts` reutilizava `FIRST_MONTH` do Orçamento para validar datas de resumo, fluxos e valorizações;
- essa validação fazia a página Investimentos falhar em Junho de 2026 com `O resumo deve ser igual ou posterior a Julho de 2026.`;
- a validação de datas de Investimentos deixou de ter limite mínimo de Julho de 2026;
- `src/app/(app)/investimentos/actions.ts` deixou de normalizar meses de fluxos/valorizações através de `normaliseMonth`, preservando meses reais como `2025-05`;
- a criação de investimento passou a aceitar mês de início anterior a Julho de 2026;
- a interface mostra o campo `Início` ao criar investimento e preserva o `startMonth` existente ao editar;
- entregas, resgates e valorizações de 2025 são aceites, com confirmação histórica quando aplicável;
- esses registos entram no cálculo de total entregue, total resgatado, capital líquido, ganho/perda, rentabilidade simples e XIRR;
- valorizações futuras face à data de referência continuam excluídas;
- a regra de Julho de 2026 permanece limitada ao módulo de Orçamento.

Validações técnicas desta correcção:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- `npm.cmd test` passou com permissão elevada: 25 ficheiros e 195 testes;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados.

Nota da integração de valorizações de Investimentos com Orçamento/Património em 26/06/2026:

- a interface activa de Investimentos deixou de expor o campo `Nota` em criação, edição e listagem de entregas, resgates e valorizações;
- as colunas `note` permanecem no schema e nos tipos por compatibilidade, mas a UI já não as utiliza;
- a lista cronológica de movimentos e valorizações passou a ficar recolhida por defeito em cada investimento;
- cada investimento tem controlo independente `Ver detalhe`/`Ocultar detalhe`, sem persistência no Supabase;
- a lista de detalhe foi compactada, com linhas, inputs e acções mais baixas e select `Entrega`/`Resgate` sem texto cortado;
- o Orçamento mensal deixou de usar `investment_month_values` como origem futura do valor dos investimentos;
- `src/server/budget/monthly-overview.ts` passou a carregar `investment_valuations` e a seleccionar, por activo e por mês, a última valorização com `valuation_date <= último dia do mês`;
- uma valorização de Julho entra em Julho; uma valorização posterior a 31/07 não entra em Julho; a última valorização elegível é transportada para meses seguintes até existir outra;
- entregas e resgates não alteram directamente o valor de mercado no Orçamento;
- contas `investment_cash`, como `T212 Cash`, continuam a entrar apenas como contas de liquidez/património e não são duplicadas no total de Investimentos;
- a linha `Investimentos` da secção Património da tabela mensal, o card superior `Investimentos` e o `Património líquido` passam a reflectir o total das valorizações elegíveis;
- alterações em Investimentos passaram a revalidar também `/orcamento`;
- não foi criada migration nova nesta integração;
- a tab Histórico ainda não foi integrada com Investimentos.

Validações técnicas desta integração:

- `npm.cmd run lint` passou;
- `npm.cmd run typecheck` passou;
- `npm.cmd test` passou com permissão elevada: 26 ficheiros e 202 testes;
- `npm.cmd run build` passou;
- `git diff --check` passou, apenas com avisos CRLF já esperados.

### 10.2 Problemas ainda existentes

A Fase 2 aguarda validação manual desta revisão antes de commit.

Problemas confirmados:

- aplicar as migrations `20260701009000_investment_cash_flows_and_valuations.sql`, `20260701010000_investment_assets_description.sql` e `20260701011000_investment_dates_before_budget_start.sql` antes de usar a tab Investimentos contra Supabase real, caso ainda não estejam aplicadas;
- validar manualmente no browser a integração das valorizações de Investimentos com Orçamento e Património;
- validar manualmente no browser o CRUD real da tab Investimentos;
- validar manualmente no browser a protecção de alterações históricas assim que existirem meses anteriores utilizáveis;
- confirmar em browser que mudanças de mês preservam autosaves pendentes e usam o mês correcto;
- continuar a validar totais horizontais e cartões superiores contra cenários reais com várias contas/cartões;
- a integração de Investimentos com a tab Histórico ainda não foi implementada.

Não avançar para a Fase 3 antes de concluir estes pontos.

## 11. Regras funcionais do Orçamento mensal

### 11.1 Primeiro mês

Julho de 2026 é actualmente o primeiro mês disponível.

No primeiro mês, o Saldo inicial é introduzido manualmente por conta.

Nos meses seguintes:

```text
Saldo inicial do mês = Saldo final do mês anterior
```

O saldo transportado:

- não deve ser editável;
- deve actualizar se o mês anterior for alterado;
- não deve ser guardado como duplicação manual;
- deve poder indicar a origem.

### 11.2 Saldo actual

“Saldo actual” é automático e apenas de leitura.

Representa o saldo resultante do saldo inicial transportado e do movimento agregado introduzido pelo utilizador.

```text
Saldo actual = Saldo inicial + Movimentos realizados
```

Regras:

- o utilizador não edita directamente esta linha;
- actualiza imediatamente quando `Saldo inicial` ou `Movimentos realizados` mudam;
- zero aparece como `–`;
- `account_month_states.current_balance_override_cents` permanece apenas como fallback de compatibilidade para dados antigos.

### 11.3 Movimentos realizados

“Movimentos realizados” é introduzido manualmente pelo utilizador por conta e mês.

```text
Saldo actual = Saldo inicial + Movimentos realizados
```

Regras:

- valor positivo aumenta o saldo;
- valor negativo reduz o saldo;
- campo vazio ou zero equivale a movimento zero;
- aceita valores positivos, negativos e decimais;
- é persistido em `account_month_states.realised_movements_override_cents`;
- mês futuro sem movimento introduzido usa `Movimentos realizados = 0`;
- não são gerados movimentos artificiais para meses futuros;
- esta linha não usa `actual_movements`;
- novas gravações deixam `account_month_states.current_balance_override_cents` a `null`.

### 11.4 Débitos directos

“Débitos directos” é calculado a partir da tab própria.

```text
Débitos directos = soma dos débitos directos previstos para a conta no mês
```

Os valores são guardados como positivos e subtraídos no orçamento.

A tab Débitos directos suporta:

- nome;
- valor;
- conta;
- dia de cobrança;
- data de início;
- data de fim opcional;
- periodicidade mensal;
- activo/inactivo;
- criar;
- editar;
- arquivar;
- reactivar;
- eliminar quando permitido.

Regra de inclusão mensal:

- regra activa;
- regra não arquivada;
- mês seleccionado igual ou posterior ao mês de início;
- mês seleccionado igual ou anterior ao mês de fim, quando existir fim.

Regras adicionais:

- o valor é armazenado como montante positivo em cêntimos;
- no orçamento mensal o impacto é sempre negativo;
- a linha `Débitos directos` no orçamento mensal é apenas de leitura;
- dia 29, 30 ou 31 é ajustado para o último dia válido do mês quando necessário;
- o dia de cobrança não marca uma ocorrência como paga nem a remove automaticamente da previsão;
- regras arquivadas ficam fora do cálculo, mas podem ser reactivadas.

Contas elegíveis:

- qualquer conta activa pode ser escolhida;
- cartões de crédito são válidos;
- contas arquivadas ou inactivas não são elegíveis para novas associações;
- uma regra existente ligada a conta arquivada pode continuar a ser apresentada sem corromper a configuração.

Checklist mensal no Orçamento:

- mostra os débitos aplicáveis ao mês seleccionado;
- parte sempre de regras ainda existentes em `recurring_rules`;
- nunca apresenta nem calcula estados mensais isolados sem a respectiva regra;
- agrupa por conta;
- ordena contas pela ordem definida na gestão de Contas;
- ordena débitos dentro da conta por maior montante;
- checkbox desmarcada = ainda previsto;
- checkbox marcada = excluído da previsão desse mês;
- o estado é persistido em `recurring_rule_month_states`;
- ausência de estado mensal equivale a desmarcado;
- marcar faz upsert do estado mensal;
- desmarcar remove o estado mensal, mantendo o comportamento por defeito.
- eliminar definitivamente uma regra remove explicitamente os seus estados mensais e a foreign key também tem `ON DELETE CASCADE` como protecção;
- a UI só remove localmente a regra depois de a Server Action confirmar a eliminação.

### 11.5 Day to day

O plafond diário é configurável na tab Configurações.

A UI sugere como valor inicial:

```text
€50,00 por dia
```

Uma configuração só passa a contar depois de gravada em `daily_budget_versions`.

Cada versão define:

- plafond diário;
- conta;
- mês de entrada em vigor.

Para um mês seleccionado, a aplicação usa a versão mais recente com:

```text
effective_from_month <= mês seleccionado
```

A conta pode ser qualquer conta activa. Não há filtragem por tipo de conta.

Não distribuir o plafond por várias contas.

#### Mês passado

```text
Day to day = €0
```

As despesas efectivas já devem estar reflectidas em Movimentos realizados.

#### Mês actual

Incluir o dia actual.

```text
Dias considerados = último dia do mês - dia actual + 1
Day to day = dias considerados × plafond diário
```

Exemplo: se hoje for 25 de Junho, contar 25, 26, 27, 28, 29 e 30.

A data actual deve ser calculada em Europe/Lisbon. As funções de domínio aceitam uma data de referência explícita para testes.

#### Mês futuro

```text
Day to day = número total de dias do mês × plafond diário
```

Exemplos:

- Julho com 31 dias: €1.550;
- Setembro com 30 dias: €1.500.

A linha é apenas de leitura.

Persistência e cálculo:

- `daily_budget_versions` guarda a configuração;
- o orçamento não grava esta linha em `budget_items`;
- resíduos antigos de `budget_items` com `source_type = 'day_to_day'` são ignorados.

### 11.6 Pagamentos de cartões

Os pagamentos de cartões são semi-automáticos e apenas de leitura na tabela mensal.

Cada cartão de crédito deve ter uma conta de pagamento associada em `accounts.linked_payment_account_id`.

Valor automático por cartão:

```text
Pagamento automático = max(0, -Saldo actual do cartão)
```

Regras:

- o cálculo usa o Saldo actual do cartão antes de previsões futuras;
- a conta de pagamento recebe o valor negativo;
- o cartão recebe o mesmo valor positivo;
- o total da linha deve somar zero quando todos os cartões têm conta de pagamento válida;
- se faltar conta de pagamento válida, apresentar aviso e não calcular silenciosamente esse cartão;
- overrides mensais são guardados em `credit_card_statement_overrides`;
- override positivo ou zero substitui o automático;
- ausência de override usa o automático;
- limpar o override volta ao automático;
- zero é um override válido e diferente de ausência de override;
- resíduos antigos de `budget_items` com `source_type = 'credit_card_payments'` são ignorados.

### 11.7 Salário

“Salário” é calculado automaticamente a partir de `salary_versions` e controlado mensalmente por `salary_month_overrides`.

Configuração:

- conta de recebimento;
- salário mensal normal;
- valor do subsídio de férias;
- mês do subsídio de férias;
- valor do subsídio de Natal;
- mês do subsídio de Natal;
- mês de entrada em vigor.

Regras:

- a configuração é versionada;
- em mês normal, usa o salário mensal normal;
- no mês do subsídio de férias, usa apenas o valor configurado para esse subsídio;
- no mês do subsídio de Natal, usa apenas o valor configurado para esse subsídio;
- o subsídio substitui o salário normal nesse mês, não é somado;
- os dois subsídios não podem estar configurados para o mesmo mês;
- o valor é positivo;
- o valor aparece apenas na conta de recebimento;
- a linha `Salário` é apenas de leitura na tabela mensal;
- valores zero aparecem como `–`.

Controlo mensal:

- a caixa `Salário do mês` fica por baixo da tabela mensal;
- mostra o valor previsto do mês;
- permite marcar `Já reflectido no saldo actual`;
- checkbox desmarcada inclui o salário na previsão;
- checkbox marcada faz a linha `Salário` passar a zero nesse mês;
- o estado é independente por mês e persiste em `salary_month_overrides.status`;
- ausência de registo mensal equivale a salário previsto.

Campos antigos:

- `salary_month_overrides.amount_cents` e `salary_month_overrides.account_id` podem existir no schema;
- estes campos não participam nos cálculos actuais de Salário;
- a interface mensal não permite definir valor excepcional de salário.

### 11.8 Linhas personalizadas

Na secção de previsões do mês deve existir:

```text
+ Adicionar linha
```

Deve ser possível criar linhas específicas do mês, por exemplo:

- Viagem;
- Seguro extraordinário;
- Reparação;
- Reembolso de despesa;
- Entrada extraordinária.

Regras:

- não existe selector de tipo na tabela mensal;
- valores positivos adicionam ao orçamento;
- valores negativos subtraem ao orçamento;
- valores zero não têm impacto;
- o total da linha é a soma algébrica dos valores por conta;
- não deve existir inversão de sinal baseada em tipo ou categoria.

Operações:

- criar;
- editar nome;
- editar por conta;
- eliminar com confirmação.

As linhas personalizadas pertencem apenas ao mês seleccionado.

Persistência:

- `budget_items` com `source_type = 'manual'`;
- `budget_items.category = 'other'` para novas linhas, apenas por compatibilidade com o schema existente;
- `budget_items.sort_order` para ordenação;
- `budget_allocations.amount_cents` guarda o valor assinado por conta.

Gravação:

- a tabela mensal já não usa botão global `Guardar alterações`;
- alterações em células actualizam os cálculos locais imediatamente;
- a gravação acontece por autosave em blur e por debounce;
- gravações pendentes são consolidadas para evitar que alterações antigas se sobreponham às mais recentes na mesma sessão;
- antes de sair da página ou mudar de contexto, a tabela tenta descarregar alterações pendentes quando possível.

### 11.9 Subtotal antes do salário

```text
Despesas previstas =
Débitos directos
+ Day to day
+ Pagamentos de cartões
+ linhas personalizadas com valores negativos
```

```text
Entradas previstas antes do salário =
linhas personalizadas com valores positivos
```

```text
Subtotal antes do salário =
Saldo actual
- Despesas previstas
+ Entradas previstas antes do salário
```

Na implementação actual, as linhas personalizadas entram neste cálculo através da sua soma algébrica assinada.

### 11.10 Saldo final

```text
Saldo final = Subtotal antes do salário + Salário
```

### 11.11 Coluna Total

A coluna Total deve somar horizontalmente todas as contas activas e visíveis para cada linha.

Um resultado válido igual a zero deve aparecer como:

```text
–
```

Usar `–` para zero em visualização normal. O campo editável de `Movimentos realizados` deve representar zero como campo vazio com placeholder `–`, mantendo campo vazio ou zero como movimento igual a zero.

## 12. Cartões superiores

Os cartões devem reutilizar as mesmas funções centrais da tabela.

```text
Liquidez actual = Total do Saldo actual
Liquidez final = Total do Saldo final
Previsões = Despesas previstas - Entradas previstas antes do salário
Dívida dos cartões = soma dos saldos actuais negativos dos cartões
Investimentos = valor automático do módulo de investimentos
Património líquido = cálculo central de Net Assets
```

Não criar fórmulas diferentes para os cartões.

## 13. Património líquido

Net Assets ou Património líquido deve considerar apenas contas marcadas para inclusão.

O cálculo deve ser centralizado.

Quando uma conta, saldo ou investimento for alterado, o património líquido deve actualizar automaticamente.

## 14. Regras visuais aprovadas

Não alterar significativamente:

- cores;
- tipografia;
- navegação;
- estrutura dos cartões;
- largura geral da tabela.

Não voltar a introduzir caixas ou faixas grandes com:

- “Posição antes do salário”;
- “Salário”;
- “Posição final”.

A tabela deve ser compacta.

Referência de densidade:

- linhas normais entre 28 px e 32 px;
- inputs até 28–30 px de altura;
- padding vertical entre 3 px e 5 px;
- cabeçalhos de secção entre 26 px e 30 px;
- sem margens verticais excessivas;
- sem grandes espaços vazios entre linhas.

Linhas automáticas devem aparecer como texto ou célula calculada, não como input.

## 15. Investimentos

A tab Investimentos começou a ser implementada após a estabilização da Fase 2.

Estado actual:

- modelo de dados criado para activos, fluxos e valorizações;
- domínio puro criado para métricas e XIRR;
- serviços Supabase e Server Actions criados;
- interface funcional ligada ao Supabase para gestão dos investimentos;
- interface activa sem campo `Nota` para fluxos e valorizações;
- lista cronológica por investimento recolhida por defeito e expandida por investimento;
- integrada com Orçamento e Património através das valorizações elegíveis em `investment_valuations`;
- ainda não integrada com a tab Histórico;
- ainda sem gráficos.

O módulo deve suportar:

- fundos;
- entregas;
- resgates;
- valorizações;
- valor de mercado;
- ganho/perda;
- rentabilidade simples;
- TIR/XIRR individual;
- TIR/XIRR global;
- histórico;
- gráfico.

Fundos inicialmente previstos:

1. Core Equity & Sector Tilt;
2. Portfolio em Growth/Tech;
3. Asia + EM;
4. AI Power Grid.

O modelo deve permitir criar outros fundos no futuro.

### 15.1 Entidades previstas

#### Fundos

- id;
- nome;
- descrição;
- estado;
- ordem;
- eventual ligação a conta;
- timestamps.

#### Movimentos de investimento

- fundo;
- data;
- tipo: entrega ou resgate;
- montante positivo;
- nota opcional no schema, actualmente não exposta na UI activa.

#### Valorizações

- fundo;
- data;
- valor de mercado;
- nota opcional no schema, actualmente não exposta na UI activa.

Não permitir duplicação de valorização para o mesmo fundo e data.

### 15.2 Cálculos

```text
Capital investido líquido = entregas - resgates
Ganho/perda = valor de mercado - capital investido líquido
Rentabilidade simples = ganho/perda ÷ capital investido líquido
```

A XIRR deve usar:

- entregas como fluxos negativos;
- resgates como fluxos positivos;
- valor de mercado como fluxo positivo;
- dias reais;
- base de 365 dias;
- Newton-Raphson com fallback robusto;
- tratamento de não convergência.

A TIR global não deve ser média das TIR individuais.

## 16. Integração mensal dos Investimentos

A linha “Investimentos” do Orçamento é automática e calculada a partir das valorizações registadas.

Para cada fundo e data de referência:

```text
Seleccionar a valorização mais recente
com valuation_date <= data limite
```

Formalmente:

```text
MAX(valuation_date) WHERE valuation_date <= data_limite
```

Nunca:

- escolher a valorização mais antiga do mês;
- calcular média;
- somar várias valorizações do mesmo fundo;
- usar dados futuros.

### 16.1 Data limite

```text
data_limite = último dia do mês seleccionado
```

Regras:

- mês passado: último dia do mês;
- mês actual: último dia do mês;
- mês futuro: último dia do mês.

### 16.2 Transporte da última valorização

Exemplo:

- valorização em 20/07: usada em Julho;
- valorização em 01/08: usada em Agosto;
- se não existir nova valorização em Setembro, Setembro continua a usar 01/08.

A valorização de Agosto nunca pode alterar Julho.

Cada fundo pode usar uma data de valorização diferente.

Se um fundo não tiver valorização elegível:

- não é criada valorização artificial;
- o fundo não acrescenta valor ao total mensal enquanto não existir valorização elegível;
- não gerar erro.

### 16.3 Ligação ao Orçamento

```text
Investimentos do mês =
soma da última valorização elegível de cada fundo activo
```

A linha deve ser:

- automática;
- apenas de leitura;
- incluída em Património líquido;
- recalculada ao criar, editar ou eliminar uma valorização;
- não guardada como duplicação manual mensal.
- baseada em `investment_valuations`, não em `investment_month_values`.

## 17. Formatação

Toda a interface deve usar:

- português de Portugal;
- datas DD/MM/AAAA;
- moeda EUR;
- `Intl.NumberFormat("pt-PT")`;
- duas casas decimais.

Valores monetários exactamente iguais a zero devem ser apresentados como `–` em visualização normal.

Nunca apresentar ao utilizador:

- `NaN`;
- `Infinity`;
- `undefined`;
- stack traces;
- mensagens técnicas não tratadas.

## 18. Testes e validação

Depois de qualquer alteração relevante, executar:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Testes mínimos da Fase 2:

- movimentos realizados editáveis; **coberto por testes de componente e snapshots mensais**
- entradas e saídas com sinal correcto; **coberto para linhas personalizadas**
- saldo actual automático/read-only; **coberto como `Saldo inicial + Movimentos realizados`**
- saldo inicial transportado; **coberto**
- débitos directos; **coberto por testes de domínio, integração mensal e componente**
- Day to day para mês passado, actual e futuro; **coberto por testes de domínio e integração mensal**
- conta correcta para Day to day; **coberto por testes de domínio e componente**
- despesa personalizada; **coberto**
- reembolso; **coberto**
- salário normal, subsídios e checkbox mensal; **coberto por testes de domínio, snapshots mensais e componente**
- linhas personalizadas sem selector de tipo; **coberto por testes de componente**
- autosave da tabela mensal; **coberto por testes de componente**
- subtotal antes do salário; **coberto com previsões personalizadas, Day to day, Débitos directos e Pagamentos de cartões**
- saldo final; **coberto com previsões personalizadas, Day to day, Pagamentos de cartões e Salário**
- totais horizontais; **coberto estruturalmente nas linhas automáticas e totais da tabela**
- cartões coerentes; **coberto por testes de domínio, integração mensal e componente**
- valores zero; **coberto**
- persistência; **coberta estruturalmente via `account_month_states.realised_movements_override_cents` e `budget_items`/`budget_allocations`; validar com Supabase real após migration**
- recálculo após refresh;
- linhas calculadas não editáveis; **coberto para Saldo actual, Débitos directos, Day to day, Pagamentos de cartões e Salário**
- tabela compacta.
- Investimentos: domínio, XIRR, valorização mensal, CRUD de activos, fluxos, valorizações, eliminação segura, protecção histórica, UI sem notas, detalhe recolhível e integração com Orçamento/Património; **coberto por testes de domínio, serviço, actions, componente e página**

## 19. Comandos úteis

### Desenvolvimento

```powershell
npm.cmd run dev
```

Abrir normalmente:

```text
http://localhost:3000
```

### Supabase

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref PROJECT_REF
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

### Seed

```powershell
npm.cmd run db:seed
```

### Git

```powershell
git status
git add .
git commit -m "Descrição da alteração"
git log --oneline -5
```

## 20. Instrução inicial para qualquer nova thread do Codex

```text
Antes de alterar qualquer ficheiro, lê integralmente PROJECT_CONTEXT.md e inspecciona o estado real do repositório. Não assumes que o histórico da conversa anterior está disponível. Confirma no código, migrations, testes e Git o que já está implementado. Em caso de discrepância, identifica-a antes de alterar ficheiros. No final da execução, actualiza PROJECT_CONTEXT.md.
```

## 21. Próximo passo recomendado

O próximo trabalho deve continuar exclusivamente na Fase 2:

1. aplicar no Supabase real as migrations pendentes de Investimentos, quando for oportuno;
2. validar manualmente no browser o CRUD de investimentos, fluxos e valorizações;
3. criar commit Git se a validação manual for aprovada;
4. avançar depois para a integração de Investimentos com a tab Histórico;
5. só depois considerar gráficos ou funcionalidades adicionais.
