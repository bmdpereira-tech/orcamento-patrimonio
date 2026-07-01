# Decisions

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
