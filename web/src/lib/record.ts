export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const fieldOf = (value: unknown, field: string): unknown =>
  isRecord(value) ? value[field] : undefined;
