# Decisions

## 2026-07-01 — Header compacto em desktop

- O header fica numa única linha horizontal em desktop/laptop, com logo/nome da app à esquerda, navegação ao centro/direita e `Terminar sessão` à direita.
- A altura de desktop deve manter-se compacta, aproximadamente entre 64px e 76px.
- A quebra do menu fica reservada para ecrãs pequenos/mobile, onde a largura deixa de ser suficiente.
- A largura máxima do header foi aumentada para aproveitar melhor o espaço lateral disponível.
- O menu `IGCP` usa um ícone neutro de documento/recibo (`ReceiptText`) em vez do ícone `%`, para que a leitura visual seja apenas `IGCP`.
- Não houve alteração funcional aos menus, rotas, cálculos, persistência ou dados.

## 2026-07-01 — IGCP autónomo com persistência local

- O submenu `IGCP` foi criado como rota própria em `/igcp`, dentro do layout autenticado existente.
- O módulo é deliberadamente autónomo: não lê nem escreve na tabela mensal, contas, Net Assets, movimentos previstos/realizados, Histórico ou Investimentos.
- Não foi criada migration nem ligação nova a Supabase; os dados editados pelo utilizador ficam em `localStorage` na chave versionada `orcamento.igcp.rows.v1`.
- A lógica financeira ficou centralizada em `src/domain/budget/igcp.ts`: parsing de datas/montantes/taxas, normalização da taxa anual, cálculo do juro trimestral líquido, distribuição mensal, totais e ganho acumulado.
- A retenção na fonte é aplicada por factor `0.72`, equivalente a deduzir 28% ao juro trimestral bruto.
- Os totais mensais tratam diferenças de arredondamento ao cêntimo dentro do domínio para preservar os totais iniciais fornecidos no pedido.

## 2026-07-01 — Expressões só calculam no commit

- Durante a edição de `Movimentos realizados`, o input mantém um draft local com o texto bruto introduzido pelo utilizador.
- Esse draft não actualiza `cellValues`, não recalcula saldos e não dispara autosave enquanto o utilizador escreve.
- O valor financeiro confirmado só é actualizado quando há commit explícito: Enter, Tab/mudança de célula ou blur.
- A validação e avaliação da expressão continuam a usar o parser seguro `evaluateCurrencyExpressionCents`, sem `eval()`.
- O comportamento commit-only fica limitado a `Movimentos realizados`; os restantes campos editáveis mantêm o fluxo anterior.

## 2026-06-29 — Expressões em Movimentos realizados

- `Movimentos realizados` aceita expressões simples para facilitar a introdução de ajustes agregados do mês.
- A persistência continua a guardar apenas o resultado numérico final em `account_month_states.realised_movements_override_cents`.
- Foi escolhido um parser próprio e restrito em `src/domain/budget/money.ts`, sem `eval()` e sem execução de código arbitrário.
- A funcionalidade fica limitada à linha `Movimentos realizados`; linhas personalizadas e restantes campos monetários editáveis mantêm o comportamento anterior.
- Em caso de expressão inválida, a UI não grava e repõe o último valor válido conhecido.
