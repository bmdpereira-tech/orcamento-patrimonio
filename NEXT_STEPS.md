# Next Steps

## Estado actual

- A app está em fase pré-publicação.
- A última alteração funcional é a aceitação de expressões matemáticas simples em `Movimentos realizados`.
- Não há migrations novas associadas a esta alteração.

## Próxima validação recomendada

- Validar no browser expressões como `-1000+2200`, `1200-350`, `(1000+200)/2` e `1500/2`.
- Confirmar que Enter e blur guardam apenas o resultado final.
- Confirmar que uma expressão inválida, como `abc+100`, não grava e repõe o valor anterior.
- Depois de validação manual, criar commit desta alteração se estiver aprovada.
