# Changelog

## 2026-07-01

- Corrigido o comportamento de edição de expressões em `Movimentos realizados`.
- O campo mantém o texto bruto enquanto o utilizador escreve, sem calcular nem formatar durante `onChange`.
- A expressão só é avaliada no commit da edição: Enter, Tab/mudança de célula ou blur.
- Expressões inválidas continuam sem ser gravadas e repõem o valor anterior.

## 2026-06-29

- A linha `Movimentos realizados` da tabela mensal passou a aceitar expressões matemáticas simples.
- Expressões válidas são avaliadas e gravadas apenas como valor monetário final.
- Expressões inválidas não são gravadas, repõem o valor anterior e mostram feedback discreto.
- A alteração não criou migrations nem alterou a lógica financeira das restantes linhas.
