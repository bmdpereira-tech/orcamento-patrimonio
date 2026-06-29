# Changelog

## 2026-06-29

- A linha `Movimentos realizados` da tabela mensal passou a aceitar expressões matemáticas simples.
- Expressões válidas são avaliadas e gravadas apenas como valor monetário final.
- Expressões inválidas não são gravadas, repõem o valor anterior e mostram feedback discreto.
- A alteração não criou migrations nem alterou a lógica financeira das restantes linhas.
