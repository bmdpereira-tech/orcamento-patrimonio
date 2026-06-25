# PROJECT_CONTEXT.md

> **Última actualização:** 25/06/2026  
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

Novas migrations devem:

- ter timestamp posterior a `20260701002000`;
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
- `Saldo actual` é editável manualmente por conta e por mês;
- `Saldo actual` é persistido em `account_month_states.current_balance_override_cents`;
- `Movimentos realizados` é automático e read-only;
- `Movimentos realizados = Saldo actual - Saldo inicial`;
- o transporte mensal continua a usar o saldo final do mês anterior como saldo inicial do mês seguinte;
- a tab Histórico mostra uma visão mensal agregada, não uma lista de transacções;
- o Histórico apresenta apenas meses anteriores ao mês actual, ordenados do mais recente para o mais antigo;
- `Variação de liquidez = saldos finais de contas de liquidez - saldos iniciais de contas de liquidez`;
- `Variação de investimentos = saldos finais de contas classificadas como investimento - saldos iniciais dessas contas`;
- linhas personalizadas mensais são suportadas em `budget_items`/`budget_allocations`;
- linhas personalizadas têm descrição, tipo (`Despesa` ou `Entrada`), valores por conta, mês, ordem e eliminação;
- valores de linhas personalizadas são introduzidos como absolutos; o tipo determina o sinal;
- zeros em visualização normal aparecem como `–`;
- a tabela mensal foi compactada verticalmente sem alterar a largura;
- a página Contas usa um contentor mais largo, semelhante ao do Orçamento.

Validações técnicas reportadas pelo Codex:

- lint passou;
- typecheck passou;
- testes passaram;
- build passou.

Estas validações devem ser repetidas após novas alterações.

### 10.2 Problemas ainda existentes

A Fase 2 não está concluída.

Problemas confirmados:

- os cálculos verticais por conta ainda não estão totalmente concluídos para previsões futuras;
- os totais horizontais funcionam apenas parcialmente;
- “Débitos directos” deve ser automático;
- “Day to day” ainda não calcula o plafond diário;
- algumas linhas calculadas futuras ainda poderão aparecer como inputs até serem automatizadas;
- a tab Débitos directos ainda precisa de ser validada ou concluída;
- a tab Configurações ainda precisa de suportar o plafond diário e a conta associada;
- a tab Investimentos ainda não está implementada funcionalmente.

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

“Saldo actual” é introduzido manualmente pelo utilizador por conta e mês.

Representa o saldo real visto no banco, cartão ou outra conta no momento da actualização.

O valor:

- é editável na tabela mensal;
- aceita valores positivos, negativos e zero;
- é persistido em `account_month_states.current_balance_override_cents`;
- não depende de movimentos individuais.

### 11.3 Movimentos realizados

“Movimentos realizados” é automático e apenas de leitura.

```text
Movimentos realizados = Saldo actual - Saldo inicial
```

Regras:

- o utilizador nunca edita directamente esta linha;
- alterações em `Saldo actual` actualizam esta diferença;
- esta linha não usa `actual_movements`.

### 11.4 Débitos directos

“Débitos directos” deve ser calculado a partir da tab própria.

```text
Débitos directos = soma dos débitos directos previstos para a conta no mês
```

Os valores são guardados como positivos e subtraídos no orçamento.

A tab Débitos directos deve suportar pelo menos:

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

### 11.5 Day to day

Existe um plafond diário inicial de:

```text
€50,00 por dia
```

O valor deve ser configurável na tab Configurações e deve existir uma conta seleccionada para despesas quotidianas.

Não distribuir o plafond por várias contas.

#### Mês passado

```text
Day to day = €0
```

As despesas efectivas já devem estar reflectidas em Movimentos realizados.

#### Mês actual

Não incluir o dia actual.

```text
Dias restantes = último dia do mês - data actual
Day to day = dias restantes × plafond diário
```

Exemplo: se hoje for 25 de Junho, contar 26, 27, 28, 29 e 30.

#### Mês futuro

```text
Day to day = número total de dias do mês × plafond diário
```

Exemplos:

- Julho com 31 dias: €1.550;
- Setembro com 30 dias: €1.500.

Se não existir conta seleccionada para Day to day, apresentar um aviso de configuração.

A linha é apenas de leitura.

### 11.6 Pagamentos de cartões

Mantém-se editável enquanto não existir um módulo automático próprio.

Os valores devem ser positivos e subtraídos pelas fórmulas.

### 11.7 Salário

O salário é editável por conta.

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

Tipos mínimos:

- Despesa;
- Entrada/Reembolso.

Os valores são introduzidos como positivos.

Regras:

- Despesa: subtrai;
- Entrada/Reembolso: adiciona.

Operações:

- criar;
- editar nome;
- alterar tipo;
- editar por conta;
- eliminar com confirmação.

As linhas personalizadas pertencem apenas ao mês seleccionado.

Persistência:

- `budget_items` com `source_type = 'manual'`;
- `budget_items.category = 'expense'` ou `'income'`;
- `budget_items.sort_order` para ordenação;
- `budget_allocations` para valores por conta.

### 11.9 Subtotal antes do salário

```text
Despesas previstas =
Débitos directos
+ Day to day
+ Pagamentos de cartões
+ linhas personalizadas do tipo Despesa
```

```text
Entradas previstas antes do salário =
linhas personalizadas do tipo Entrada/Reembolso
```

```text
Subtotal antes do salário =
Saldo actual
- Despesas previstas
+ Entradas previstas antes do salário
```

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

Usar `–` para zero em visualização normal. Campos editáveis podem mostrar `0,00`.

## 12. Cartões superiores

Os cartões devem reutilizar as mesmas funções centrais da tabela.

```text
Liquidez actual = Total do Saldo actual
Liquidez final = Total do Saldo final
Previsões = Despesas previstas - Entradas previstas antes do salário
Dívida dos cartões = Total de Pagamentos de cartões
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

## 15. Fase 3 — Investimentos

A tab Investimentos ainda não deve ser implementada antes da conclusão da Fase 2.

Quando avançar, deve suportar:

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
- notas.

#### Valorizações

- fundo;
- data;
- valor de mercado;
- notas.

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

Depois da implementação da tab Investimentos, a linha “Investimentos” do Orçamento deve ser automática.

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
data_limite = MIN(último dia do mês seleccionado, data actual)
```

Regras:

- mês passado: último dia do mês;
- mês actual: data actual;
- mês futuro: data actual.

### 16.2 Transporte da última valorização

Exemplo:

- valorização em 20/07: usada em Julho;
- valorização em 01/08: usada em Agosto;
- se não existir nova valorização em Setembro, Setembro continua a usar 01/08.

A valorização de Agosto nunca pode alterar Julho.

Cada fundo pode usar uma data de valorização diferente.

Se um fundo não tiver valorização elegível:

- não assumir zero como valorização real;
- apresentar “Sem valorização”;
- indicar que o total está incompleto;
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

- movimentos realizados automáticos; **coberto por diferença entre saldo actual e inicial**
- entradas e saídas com sinal correcto; **coberto para linhas personalizadas**
- saldo actual; **coberto como campo editável/manual**
- saldo inicial transportado; **coberto**
- débitos directos;
- Day to day para mês passado, actual e futuro;
- conta correcta para Day to day;
- despesa personalizada; **coberto**
- reembolso; **coberto**
- subtotal antes do salário;
- saldo final; **coberto com previsões personalizadas**
- totais horizontais;
- cartões coerentes;
- valores zero; **coberto**
- persistência; **coberta estruturalmente via `budget_items`/`budget_allocations`; validar com Supabase real após migration**
- recálculo após refresh;
- linhas calculadas não editáveis; **coberto para Movimentos realizados**
- tabela compacta.

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

1. aplicar no Supabase a migration `20260701004000_budget_items_sort_order.sql`;
2. validar Orçamento e Histórico contra o Supabase remoto/local real;
3. tornar Débitos directos automático;
4. concluir a tab Débitos directos;
5. implementar o plafond Day to day de €50;
6. configurar a conta de Day to day;
7. adicionar linhas personalizadas;
8. corrigir cálculos verticais das previsões;
9. corrigir totais horizontais restantes;
10. tornar futuras linhas calculadas não editáveis;
11. compactar a tabela;
12. actualizar cartões restantes;
13. criar testes adicionais para as restantes regras;
14. aplicar migrations necessárias;
15. actualizar este ficheiro;
16. criar commit Git.

Não implementar Investimentos antes desta validação.
