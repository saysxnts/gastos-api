import { describe, expect, it } from "vitest";
import { expensesToCsv } from "../src/csv.js";
import { fromCents, toCents } from "../src/money.js";

describe("money", () => {
  it("converte sem erros de ponto flutuante", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(fromCents(1999)).toBe(19.99);
    expect(fromCents(toCents(1234.56))).toBe(1234.56);
  });
});

describe("expensesToCsv", () => {
  const base = { id: 1, amount: 10, category: "outros", date: "2026-10-01", createdAt: "" };

  it("escapa vírgulas e aspas", () => {
    const csv = expensesToCsv([{ ...base, description: 'Livro "TS", 2ª ed.' }]);
    expect(csv.split("\n")[1]).toBe('1,2026-10-01,outros,"Livro ""TS"", 2ª ed.",10.00');
  });

  it("neutraliza fórmulas de planilha", () => {
    const csv = expensesToCsv([{ ...base, description: "=HYPERLINK(1)" }]);
    expect(csv.split("\n")[1]).toBe("1,2026-10-01,outros,'=HYPERLINK(1),10.00");
  });

  it("gera apenas o cabeçalho para lista vazia", () => {
    expect(expensesToCsv([])).toBe("id,date,category,description,amount\n");
  });
});
