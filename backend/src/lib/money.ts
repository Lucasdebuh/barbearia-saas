export const toCents = (value: number) => Math.round(value * 100);
export const fromCents = (cents: number) => cents / 100;
export const formatBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
