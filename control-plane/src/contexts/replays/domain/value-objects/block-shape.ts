export type Block = Readonly<Record<string, unknown>>;

export const isBlock = (raw: unknown): raw is Block =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw);
