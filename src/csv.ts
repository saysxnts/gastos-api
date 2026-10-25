import type { Expense } from "./repository.js";

const HEADER = ["id", "date", "category", "description", "amount"];

function escapeField(value: string | number): string {
  const text = String(value);
  // Evita injeção de fórmulas ao abrir o arquivo em planilhas.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function expensesToCsv(expenses: Expense[]): string {
  const lines = [HEADER.join(",")];
  for (const e of expenses) {
    lines.push([e.id, e.date, e.category, e.description, e.amount.toFixed(2)].map(escapeField).join(","));
  }
  return lines.join("\n") + "\n";
}
