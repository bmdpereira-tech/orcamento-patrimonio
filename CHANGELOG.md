# Changelog

## 2026-07-01

- Reajustado o header para voltar a uma linha compacta em desktop/laptop, com logo, navegação e logout alinhados verticalmente.
- A quebra do menu fica reservada para ecrãs pequenos/mobile.
- O menu `IGCP` deixou de usar o ícone `%`; o texto visível mantém-se apenas `IGCP`.
- Criado o submenu autónomo `IGCP`, com nova rota `/igcp`.
- Adicionada tabela compacta para subscrições IGCP/Certificados, pré-carregada com as 9 linhas iniciais fornecidas.
- Implementado cálculo de juros trimestrais líquidos com retenção na fonte de 28%, distribuição pelos ciclos Janeiro/Abril/Julho/Outubro, Fevereiro/Maio/Agosto/Novembro ou Março/Junho/Setembro/Dezembro, totais mensais e ganho acumulado.
- A tabela permite adicionar, remover e editar linhas, com validação discreta e persistência local isolada em `localStorage`.
- Adicionados testes de domínio, componente, página, navegação e não interferência com o Orçamento mensal.
- Corrigido o comportamento de edição de expressões em `Movimentos realizados`.
- O campo mantém o texto bruto enquanto o utilizador escreve, sem calcular nem formatar durante `onChange`.
- A expressão só é avaliada no commit da edição: Enter, Tab/mudança de célula ou blur.
- Expressões inválidas continuam sem ser gravadas e repõem o valor anterior.

## 2026-06-29

- A linha `Movimentos realizados` da tabela mensal passou a aceitar expressões matemáticas simples.
- Expressões válidas são avaliadas e gravadas apenas como valor monetário final.
- Expressões inválidas não são gravadas, repõem o valor anterior e mostram feedback discreto.
- A alteração não criou migrations nem alterou a lógica financeira das restantes linhas.
