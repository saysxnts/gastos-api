import type { FastifyInstance } from "fastify";
import type { ExpenseRepository } from "../repository.js";
import { budgetBodySchema, budgetParamSchema, summaryQuerySchema } from "../schemas.js";

export async function budgetRoutes(app: FastifyInstance, opts: { repo: ExpenseRepository }) {
  const { repo } = opts;

  app.get("/budgets", async () => ({ items: repo.listBudgets() }));

  app.put("/budgets/:category", async (request) => {
    const { category } = budgetParamSchema.parse(request.params);
    const { monthlyLimit } = budgetBodySchema.parse(request.body);
    return repo.setBudget(category, monthlyLimit);
  });

  app.delete("/budgets/:category", async (request, reply) => {
    const { category } = budgetParamSchema.parse(request.params);
    if (!repo.deleteBudget(category)) return reply.code(404).send({ error: "Orçamento não encontrado" });
    return reply.code(204).send();
  });

  app.get("/reports/summary", async (request) => {
    const { month } = summaryQuerySchema.parse(request.query);
    return repo.monthlySummary(month);
  });
}
