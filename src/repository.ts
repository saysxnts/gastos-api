import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { fromCents, toCents } from "./money.js";
import type { CreateExpenseInput, ListQuery, UpdateExpenseInput } from "./schemas.js";

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
}

export interface Budget {
  category: string;
  monthlyLimit: number;
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  budget: number | null;
  remaining: number | null;
  overBudget: boolean;
}

export interface MonthlySummary {
  month: string;
  total: number;
  count: number;
  categories: CategorySummary[];
}

interface ExpenseRow {
  id: number;
  description: string;
  amount_cents: number;
  category: string;
  date: string;
  created_at: string;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: fromCents(row.amount_cents),
    category: row.category,
    date: row.date,
    createdAt: row.created_at,
  };
}

export class ExpenseRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreateExpenseInput): Expense {
    const result = this.db
      .prepare("INSERT INTO expenses (description, amount_cents, category, date) VALUES (?, ?, ?, ?)")
      .run(input.description, toCents(input.amount), input.category, input.date);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  findById(id: number): Expense | null {
    const row = this.db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as ExpenseRow | undefined;
    return row ? toExpense(row) : null;
  }

  list(query: Partial<ListQuery> = {}): { items: Expense[]; total: number } {
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (query.category) {
      where.push("category = ?");
      params.push(query.category);
    }
    if (query.from) {
      where.push("date >= ?");
      params.push(query.from);
    }
    if (query.to) {
      where.push("date <= ?");
      params.push(query.to);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { total } = this.db.prepare(`SELECT COUNT(*) AS total FROM expenses ${clause}`).get(...params) as {
      total: number;
    };
    const rows = this.db
      .prepare(`SELECT * FROM expenses ${clause} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, query.limit ?? -1, query.offset ?? 0) as unknown as ExpenseRow[];
    return { items: rows.map(toExpense), total };
  }

  update(id: number, input: UpdateExpenseInput): Expense | null {
    const current = this.findById(id);
    if (!current) return null;
    const next = { ...current, ...input };
    this.db
      .prepare("UPDATE expenses SET description = ?, amount_cents = ?, category = ?, date = ? WHERE id = ?")
      .run(next.description, toCents(next.amount), next.category, next.date, id);
    return this.findById(id);
  }

  delete(id: number): boolean {
    return Number(this.db.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes) > 0;
  }

  setBudget(category: string, monthlyLimit: number): Budget {
    this.db
      .prepare(
        `INSERT INTO budgets (category, monthly_limit_cents) VALUES (?, ?)
         ON CONFLICT(category) DO UPDATE SET monthly_limit_cents = excluded.monthly_limit_cents`,
      )
      .run(category, toCents(monthlyLimit));
    return { category, monthlyLimit };
  }

  listBudgets(): Budget[] {
    const rows = this.db
      .prepare("SELECT category, monthly_limit_cents FROM budgets ORDER BY category")
      .all() as unknown as { category: string; monthly_limit_cents: number }[];
    return rows.map((r) => ({ category: r.category, monthlyLimit: fromCents(r.monthly_limit_cents) }));
  }

  deleteBudget(category: string): boolean {
    return Number(this.db.prepare("DELETE FROM budgets WHERE category = ?").run(category).changes) > 0;
  }

  /** Totais do mês por categoria, cruzados com os orçamentos cadastrados. */
  monthlySummary(month: string): MonthlySummary {
    const rows = this.db
      .prepare(
        `SELECT c.category,
                COALESCE(e.total_cents, 0) AS total_cents,
                COALESCE(e.count, 0)       AS count,
                b.monthly_limit_cents      AS budget_cents
           FROM (SELECT category FROM expenses WHERE substr(date, 1, 7) = ?
                 UNION SELECT category FROM budgets) c
           LEFT JOIN (SELECT category, SUM(amount_cents) AS total_cents, COUNT(*) AS count
                        FROM expenses WHERE substr(date, 1, 7) = ? GROUP BY category) e
                  ON e.category = c.category
           LEFT JOIN budgets b ON b.category = c.category
          ORDER BY total_cents DESC, c.category`,
      )
      .all(month, month) as unknown as {
      category: string;
      total_cents: number;
      count: number;
      budget_cents: number | null;
    }[];

    const categories = rows.map((r) => ({
      category: r.category,
      total: fromCents(r.total_cents),
      count: r.count,
      budget: r.budget_cents === null ? null : fromCents(r.budget_cents),
      remaining: r.budget_cents === null ? null : fromCents(r.budget_cents - r.total_cents),
      overBudget: r.budget_cents !== null && r.total_cents > r.budget_cents,
    }));
    const totalCents = rows.reduce((acc, r) => acc + r.total_cents, 0);
    const count = rows.reduce((acc, r) => acc + r.count, 0);
    return { month, total: fromCents(totalCents), count, categories };
  }
}
