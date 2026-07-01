# Next Steps

## Estado actual

- A app está em fase pré-publicação.
- A última alteração funcional é o novo submenu autónomo `IGCP`, com tabela de juros trimestrais líquidos previstos para subscrições IGCP/Certificados.
- A última correcção visual voltou a compactar o header numa única linha em desktop/laptop e removeu o ícone `%` do menu `IGCP`.
- O IGCP usa persistência local isolada em `localStorage` e não criou migrations novas.

## Próxima validação recomendada

- Validar no browser a rota `/igcp` depois de autenticação.
- Confirmar visualmente que, em desktop/laptop, o header mostra logo/nome, navegação principal e `Terminar sessão` na mesma linha, com altura compacta.
- Confirmar que a navegação só quebra/adapta em ecrãs pequenos/mobile.
- Confirmar que o menu aparece como `IGCP`, sem símbolo `%` antes do texto.
- Confirmar os totais iniciais: `34 000,00 €`, `37 091,49 €`, ganho acumulado `3 091,49 €`, Janeiro `67,52 €` e Fevereiro `178,11 €`.
- Confirmar adição, remoção e edição de linhas, incluindo commit por Enter, Tab/mudança de célula e blur.
- Confirmar que valores inválidos mostram erro discreto e não são gravados em `localStorage`.
- Confirmar que `/orcamento`, `/contas`, `/investimentos`, `/historico`, `/debitos-directos` e `/configuracoes` continuam sem dependência funcional do IGCP.
- A validação manual no browser ficou pendente neste ambiente: `next dev` e `next start` escreveram `Ready`, mas a porta `127.0.0.1:3000` recusou ligação logo depois.
- Depois de validação manual, criar commit desta alteração se estiver aprovada.
