# Decisions

## 2026-06-29 — Expressões em Movimentos realizados

- `Movimentos realizados` aceita expressões simples para facilitar a introdução de ajustes agregados do mês.
- A persistência continua a guardar apenas o resultado numérico final em `account_month_states.realised_movements_override_cents`.
- Foi escolhido um parser próprio e restrito em `src/domain/budget/money.ts`, sem `eval()` e sem execução de código arbitrário.
- A funcionalidade fica limitada à linha `Movimentos realizados`; linhas personalizadas e restantes campos monetários editáveis mantêm o comportamento anterior.
- Em caso de expressão inválida, a UI não grava e repõe o último valor válido conhecido.
