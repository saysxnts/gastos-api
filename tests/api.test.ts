import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function createExpense(body: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/expenses", payload: body });
}

const sample = { description: "Mercado", amount: 152.37, category: "Alimentação", date: "2026-10-03" };

describe("GET /health", () => {
  it("responde ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("CRUD de despesas", () => {
  it("cria uma despesa e normaliza a categoria", async () => {
    const res = await createExpense(sample);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ id: 1, description: "Mercado", amount: 152.37, category: "alimentação" });
    expect(body.createdAt).toBeTypeOf("string");
  });

  it("rejeita payload inválido com detalhes", async () => {
    const res = await createExpense({ description: "", amount: -5, category: "x", date: "2026-02-30" });
    expect(res.statusCode).toBe(400);
    const fields = res.json().details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["description", "amount", "date"]));
  });

  it("rejeita valores com mais de duas casas decimais", async () => {
    const res = await createExpense({ ...sample, amount: 10.999 });
    expect(res.statusCode).toBe(400);
  });

  it("busca, atualiza e remove uma despesa", async () => {
    const { id } = (await createExpense(sample)).json();

    const got = await app.inject({ method: "GET", url: `/expenses/${id}` });
    expect(got.json().description).toBe("Mercado");

    const patched = await app.inject({ method: "PATCH", url: `/expenses/${id}`, payload: { amount: 0.1 } });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ amount: 0.1, description: "Mercado" });

    const deleted = await app.inject({ method: "DELETE", url: `/expenses/${id}` });
    expect(deleted.statusCode).toBe(204);

    const missing = await app.inject({ method: "GET", url: `/expenses/${id}` });
    expect(missing.statusCode).toBe(404);
  });

  it("PATCH vazio retorna 400 e id inexistente retorna 404", async () => {
    const { id } = (await createExpense(sample)).json();
    const empty = await app.inject({ method: "PATCH", url: `/expenses/${id}`, payload: {} });
    expect(empty.statusCode).toBe(400);
    const notFound = await app.inject({ method: "PATCH", url: "/expenses/999", payload: { amount: 1 } });
    expect(notFound.statusCode).toBe(404);
  });

  it("id não numérico retorna 400", async () => {
    const res = await app.inject({ method: "GET", url: "/expenses/abc" });
    expect(res.statusCode).toBe(400);
  });
});

describe("listagem e filtros", () => {
  beforeEach(async () => {
    await createExpense({ description: "Aluguel", amount: 1800, category: "moradia", date: "2026-09-05" });
    await createExpense({ description: "Uber", amount: 23.5, category: "transporte", date: "2026-10-02" });
    await createExpense({ description: "Feira", amount: 64.2, category: "alimentação", date: "2026-10-10" });
    await createExpense({ description: "Ônibus", amount: 4.4, category: "Transporte", date: "2026-10-12" });
  });

  it("lista ordenado por data decrescente com total", async () => {
    const res = await app.inject({ method: "GET", url: "/expenses" });
    const body = res.json();
    expect(body.total).toBe(4);
    expect(body.items.map((e: { description: string }) => e.description)).toEqual([
      "Ônibus",
      "Feira",
      "Uber",
      "Aluguel",
    ]);
  });

  it("filtra por categoria e período", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/expenses?category=TRANSPORTE&from=2026-10-01&to=2026-10-31",
    });
    expect(res.json().total).toBe(2);
  });

  it("pagina resultados", async () => {
    const res = await app.inject({ method: "GET", url: "/expenses?limit=2&offset=2" });
    const body = res.json();
    expect(body.total).toBe(4);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].description).toBe("Uber");
  });

  it("rejeita período invertido", async () => {
    const res = await app.inject({ method: "GET", url: "/expenses?from=2026-10-31&to=2026-10-01" });
    expect(res.statusCode).toBe(400);
  });

  it("exporta CSV filtrado", async () => {
    const res = await app.inject({ method: "GET", url: "/expenses/export.csv?category=transporte" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    const lines = res.body.trim().split("\n");
    expect(lines[0]).toBe("id,date,category,description,amount");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("4,2026-10-12,transporte,Ônibus,4.40");
  });
});

describe("orçamentos e relatório mensal", () => {
  it("calcula totais por categoria e sinaliza estouro de orçamento", async () => {
    await createExpense({ description: "Feira", amount: 300.1, category: "alimentação", date: "2026-10-01" });
    await createExpense({ description: "Restaurante", amount: 250, category: "alimentação", date: "2026-10-20" });
    await createExpense({ description: "Metrô", amount: 0.2, category: "transporte", date: "2026-10-03" });
    await createExpense({ description: "Metrô", amount: 0.1, category: "transporte", date: "2026-10-04" });
    await createExpense({ description: "Fora do mês", amount: 99, category: "alimentação", date: "2026-11-01" });

    const put = await app.inject({ method: "PUT", url: "/budgets/Alimentação", payload: { monthlyLimit: 500 } });
    expect(put.json()).toEqual({ category: "alimentação", monthlyLimit: 500 });
    await app.inject({ method: "PUT", url: "/budgets/lazer", payload: { monthlyLimit: 200 } });

    const res = await app.inject({ method: "GET", url: "/reports/summary?month=2026-10" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(550.4);
    expect(body.count).toBe(4);

    const byCategory = Object.fromEntries(body.categories.map((c: { category: string }) => [c.category, c]));
    expect(byCategory["alimentação"]).toEqual({
      category: "alimentação",
      total: 550.1,
      count: 2,
      budget: 500,
      remaining: -50.1,
      overBudget: true,
    });
    expect(byCategory["transporte"]).toMatchObject({ total: 0.3, budget: null, overBudget: false });
    expect(byCategory["lazer"]).toMatchObject({ total: 0, count: 0, budget: 200, remaining: 200 });
  });

  it("lista, atualiza e remove orçamentos", async () => {
    await app.inject({ method: "PUT", url: "/budgets/lazer", payload: { monthlyLimit: 200 } });
    await app.inject({ method: "PUT", url: "/budgets/lazer", payload: { monthlyLimit: 250.5 } });
    const list = await app.inject({ method: "GET", url: "/budgets" });
    expect(list.json().items).toEqual([{ category: "lazer", monthlyLimit: 250.5 }]);

    expect((await app.inject({ method: "DELETE", url: "/budgets/lazer" })).statusCode).toBe(204);
    expect((await app.inject({ method: "DELETE", url: "/budgets/lazer" })).statusCode).toBe(404);
  });

  it("exige mês no formato YYYY-MM", async () => {
    const res = await app.inject({ method: "GET", url: "/reports/summary?month=2026-13" });
    expect(res.statusCode).toBe(400);
  });
});
