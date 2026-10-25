import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  description  TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category     TEXT    NOT NULL,
  date         TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);

CREATE TABLE IF NOT EXISTS budgets (
  category            TEXT PRIMARY KEY,
  monthly_limit_cents INTEGER NOT NULL CHECK (monthly_limit_cents > 0)
);
`;

/** Abre (ou cria) o banco SQLite e aplica o schema. Use ":memory:" para testes. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(MIGRATIONS);
  return db;
}
