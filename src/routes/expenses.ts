import type { FastifyInstance } from "fastify";
import { expensesToCsv } from "../csv.js";
import type { ExpenseRepository } from "../repository.js";
import {
  createExpenseSchema,
  idParamSchema,
  listQuerySchema,
  updateExpenseSchema,
} from "../schemas.js";

export async function expenseRoutes(app: FastifyInstance, opts: { repo: ExpenseRepository }) {
  const { repo } = opts;

  app.post("/expenses", async (request, reply) => {
    const input = createExpenseSchema.parse(request.body);
    return reply.code(201).send(repo.create(input));
  });

  app.get("/expenses", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { items, total } = repo.list(query);
    return { items, total, limit: query.limit, offset: query.offset };
  });

  app.get("/expenses/export.csv", async (request, reply) => {
    const query = listQuerySchema.parse({ ...(request.query as object), limit: 100 });
    const { items } = repo.list({ ...query, limit: undefined, offset: 0 });
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="despesas.csv"')
      .send(expensesToCsv(items));
  });

  app.get("/expenses/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const expense = repo.findById(id);
    if (!expense) return reply.code(404).send({ error: "Despesa não encontrada" });
    return expense;
  });

  app.patch("/expenses/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = updateExpenseSchema.parse(request.body);
    const expense = repo.update(id, input);
    if (!expense) return reply.code(404).send({ error: "Despesa não encontrada" });
    return expense;
  });

  app.delete("/expenses/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    if (!repo.delete(id)) return reply.code(404).send({ error: "Despesa não encontrada" });
    return reply.code(204).send();
  });
}
