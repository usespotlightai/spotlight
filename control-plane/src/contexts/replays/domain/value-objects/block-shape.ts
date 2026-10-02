export type Block = Readonly<Record<string, unknown>>;

export const isBlock = (held: unknown): held is Block =>
  typeof held === 'object' && held !== null && !Array.isArray(held);
