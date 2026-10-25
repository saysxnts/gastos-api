import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from "fastify";
import { ZodError } from "zod";
import { openDatabase } from "./db.js";
import { ExpenseRepository } from "./repository.js";
import { budgetRoutes } from "./routes/budgets.js";
import { expenseRoutes } from "./routes/expenses.js";

export interface AppOptions {
  databasePath?: string;
  logger?: FastifyServerOptions["logger"];
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const db = openDatabase(options.databasePath ?? ":memory:");
  const repo = new ExpenseRepository(db);
  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error: FastifyError | ZodError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Dados inválidos",
        details: error.issues.map((i) => ({ field: i.path.join(".") || null, message: i.message })),
      });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Erro interno" });
  });

  app.addHook("onClose", async () => db.close());

  app.get("/health", async () => ({ status: "ok" }));
  app.register(expenseRoutes, { repo });
  app.register(budgetRoutes, { repo });

  return app;
}
