# gastos-api

API REST para **controle de despesas pessoais**, com orçamento mensal por categoria, relatório do mês com alerta de estouro e exportação em CSV.

O projeto foi pensado como um backend moderno e enxuto em TypeScript: validação forte com Zod, valores monetários guardados em centavos inteiros (sem erros de ponto flutuante) e persistência no SQLite nativo do Node.js (`node:sqlite`). Não há dependências nativas para compilar.

## Stack

| Camada       | Tecnologia                                   |
| ------------ | -------------------------------------------- |
| Linguagem    | TypeScript 5 (ESM, modo `strict`)            |
| Runtime      | Node.js 22.13+ ou 24                         |
| Framework    | [Fastify 5](https://fastify.dev)             |
| Validação    | [Zod 4](https://zod.dev)                     |
| Banco        | SQLite via `node:sqlite` (nativo do Node)    |
| Testes       | [Vitest](https://vitest.dev) + `app.inject`  |
| Infra        | Docker (multi-stage) e GitHub Actions        |

## Estrutura

```
src/
  app.ts            # monta o Fastify, rotas e tratamento de erros
  server.ts         # ponto de entrada (lê variáveis de ambiente)
  db.ts             # conexão e schema do SQLite
  repository.ts     # acesso a dados e relatório mensal
  schemas.ts        # validações com Zod
  money.ts          # conversão reais <-> centavos
  csv.ts            # exportação CSV (com proteção contra injeção de fórmulas)
  routes/
    expenses.ts     # CRUD de despesas + exportação
    budgets.ts      # orçamentos + relatório
tests/              # testes de integração e unitários
```

## Instalação e execução

Pré-requisito: Node.js **22.13 ou superior**.

```bash
npm install
npm run dev        # modo desenvolvimento com recarga automática (tsx)
```

Para produção:

```bash
npm run build
npm start          # servidor em http://localhost:3000
```

Variáveis de ambiente (todas opcionais):

| Variável        | Padrão      | Descrição                         |
| --------------- | ----------- | --------------------------------- |
| `PORT`          | `3000`      | Porta HTTP                        |
| `HOST`          | `0.0.0.0`   | Interface de escuta               |
| `DATABASE_PATH` | `gastos.db` | Arquivo SQLite (`:memory:` aceito) |
| `LOG_LEVEL`     | `info`      | Nível de log do Fastify (pino)    |

### Com Docker

```bash
docker build -t gastos-api .
docker run -p 3000:3000 -v gastos-data:/data gastos-api
```

### Testes

```bash
npm test           # Vitest
npm run typecheck  # checagem de tipos
```

## Endpoints

| Método   | Rota                    | Descrição                                               |
| -------- | ----------------------- | ------------------------------------------------------- |
| `GET`    | `/health`               | Verificação de saúde                                    |
| `POST`   | `/expenses`             | Cria uma despesa                                        |
| `GET`    | `/expenses`             | Lista com filtros `category`, `from`, `to`, `limit`, `offset` |
| `GET`    | `/expenses/:id`         | Detalha uma despesa                                     |
| `PATCH`  | `/expenses/:id`         | Atualiza parcialmente                                   |
| `DELETE` | `/expenses/:id`         | Remove                                                  |
| `GET`    | `/expenses/export.csv`  | Exporta em CSV (aceita os mesmos filtros da listagem)   |
| `GET`    | `/budgets`              | Lista orçamentos                                        |
| `PUT`    | `/budgets/:category`    | Cria/atualiza o limite mensal de uma categoria          |
| `DELETE` | `/budgets/:category`    | Remove um orçamento                                     |
| `GET`    | `/reports/summary?month=YYYY-MM` | Totais do mês por categoria × orçamento        |

As categorias são normalizadas para minúsculas, e as datas usam o formato `YYYY-MM-DD`. Os valores são números em reais com até duas casas decimais.

## Exemplos de uso

```bash
# Criar despesas
curl -X POST localhost:3000/expenses -H 'content-type: application/json' \
  -d '{"description":"Mercado","amount":152.37,"category":"Alimentacao","date":"2026-10-03"}'

curl -X POST localhost:3000/expenses -H 'content-type: application/json' \
  -d '{"description":"Uber","amount":23.5,"category":"transporte","date":"2026-10-05"}'

# Definir orçamento mensal
curl -X PUT localhost:3000/budgets/alimentacao -H 'content-type: application/json' \
  -d '{"monthlyLimit":100}'

# Relatório do mês
curl "localhost:3000/reports/summary?month=2026-10"
```

Resposta do relatório:

```json
{
  "month": "2026-10",
  "total": 175.87,
  "count": 2,
  "categories": [
    { "category": "alimentacao", "total": 152.37, "count": 1, "budget": 100, "remaining": -52.37, "overBudget": true },
    { "category": "transporte", "total": 23.5, "count": 1, "budget": null, "remaining": null, "overBudget": false }
  ]
}
```

Filtrar e exportar:

```bash
curl "localhost:3000/expenses?category=transporte&from=2026-10-01&to=2026-10-31&limit=10"
curl -o despesas.csv "localhost:3000/expenses/export.csv?from=2026-10-01"
```

Erros de validação retornam `400` com detalhes por campo:

```json
{ "error": "Dados inválidos", "details": [{ "field": "amount", "message": "o valor deve ser positivo" }] }
```

## Próximos passos

- Documentação OpenAPI/Swagger gerada a partir dos schemas Zod
- Autenticação (JWT) e despesas por usuário
- Receitas e saldo mensal, além das despesas
- Despesas recorrentes (assinaturas, aluguel)
- Importação de extratos em CSV/OFX
- Frontend com gráficos de evolução mensal

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
