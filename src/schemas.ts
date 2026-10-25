import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "data inválida");

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use o formato YYYY-MM");

const amount = z
  .number()
  .positive("o valor deve ser positivo")
  .max(10_000_000, "valor muito alto")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "no máximo duas casas decimais");

const category = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((v) => v.toLowerCase());

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amount,
  category,
  date: isoDate,
});

export const updateExpenseSchema = createExpenseSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, "informe ao menos um campo");

export const listQuerySchema = z
  .object({
    category: category.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, "'from' deve ser anterior ou igual a 'to'");

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const summaryQuerySchema = z.object({ month });

export const budgetParamSchema = z.object({ category });

export const budgetBodySchema = z.object({ monthlyLimit: amount });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
