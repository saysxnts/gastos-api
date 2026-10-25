/** Converte um valor em reais (ex.: 12.5) para centavos inteiros, evitando erros de ponto flutuante. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Converte centavos inteiros para reais com duas casas decimais. */
export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}
