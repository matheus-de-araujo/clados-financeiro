# Etapa 1 · o que foi feito e como testar

## O que está pronto

**Clados**
- Início com saldo, quanto dá para retirar agora e quanto falta mandar para a Casa no mês.
- Recebi, Trabalhei (horas), Paguei e Retirada. Se a retirada passa do permitido, o app avisa quanto sairia da reserva.
- Clientes com contratos de suporte, projeto e por hora, cobrança das horas e mensagem pronta para o WhatsApp.
- Extrato, Cartão Clados, contas fixas, DAS e faturamento do ano contra o limite do MEI.

**Casa**
- Início com o saldo e o que falta entrar no mês.
- Contas do mês: você marca como paga, paga outro valor ou corrige o previsto.
- Cartões com a fatura por categoria e a tela Conferir com o app do banco.
- Gastei, Paguei a fatura, Entrou, Reserva e Extrato.
- Dia de pagar em três passos: juntar o que entrou, pagar as contas, pagar as faturas.
- Fechamento do mês. Se sobrou, vai para a reserva ou fica na conta. Se faltou, sai da reserva ou vira a conta "Falta de <mês>" no mês seguinte.

**Geral**
- Login com e-mail e senha.
- Pessoas: quem edita e quem só vê cada espaço. A Dayane edita a Casa, só vê a Clados e abre na Casa.
- Ícone e instalação na tela de início do iPhone.

## Testes que rodei

**51 testes automáticos, todos passando:**
- Regras isoladas: vencimento da fatura (inclusive fevereiro), parcelas, dízimo, meta de retirada, pode retirar e resultado do mês.
- Fluxo completo no banco.
- Simulação de setembro, outubro e novembro de 2026 com os dados da planilha.

Na simulação, cenário 1, igual à planilha, levando a falta para o mês seguinte:

| Mês | Resultado do mês | Acumulado |
|---|---|---|
| Setembro | −R$ 441,14 | −R$ 441,14 |
| Outubro | −R$ 2.798,37 | −R$ 3.239,51 |
| Novembro | +R$ 338,85 | −R$ 2.900,66 |

O saldo da conta bate em todos os meses, e o saldo da Clados passa de um mês para o outro.

O cenário 2 tira da Casa o cartão PJ e o MEI, passando-os para a Clados:
- Setembro: +R$ 7.989,41, guardado na reserva.
- Outubro: −R$ 1.771,73, coberto pela reserva.
- Novembro: +R$ 1.177,57, que fica na conta e entra em dezembro.

**Fluxo pela interface,** num iPhone simulado:
- Matheus faz a retirada sugerida de R$ 3.240. A Casa passa de R$ 1.949,34 para R$ 5.189,34.
- Paga o Gás pelo check. O saldo cai para R$ 5.141,75 e as contas pagas vão a 7 de 12.
- A Dayane não consegue abrir a retirada, e a API recusa com 403.

Todas as telas foram capturadas e revisadas no tamanho do iPhone 13.

## Como testar agora no Mac

```bash
unzip financeiro-app.zip && cd financeiro-app
npm install
npm run dev
```

1. Abra http://localhost:3000 e toque em **Matheus** ou **Dayane**. Os dados são as planilhas de setembro a novembro, e "hoje" é 14/10/2026.
2. Para testar no iPhone, rode `npm run dev -- -H 0.0.0.0` e abra `http://<ip-do-mac>:3000` na mesma rede Wi-Fi. Em Compartilhar › Adicionar à Tela de Início ele vira app.
3. Reiniciar o servidor volta os dados ao início.

Um roteiro curto:
1. Como Matheus, na Clados, toque em **Fazer retirada** e veja a Casa receber o valor.
2. Na Casa, abra **Contas** e marque uma conta.
3. Abra **Dia de pagar**.
4. Volte para setembro no seletor de mês e veja o fechamento. Depois feche outubro pelo Dia de pagar.
5. Entre como Dayane e veja que a Clados aparece só para leitura.

## Por que não está no ar ainda

O projeto **clados-financeiro** já existe na sua Vercel, protegido para só quem é do time abrir. Para publicar, preciso de um repositório privado no GitHub. A Vercel publica a partir dele, e daí em diante cada mudança sobe sozinha.
