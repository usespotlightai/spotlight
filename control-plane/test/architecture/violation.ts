export type Violation = {
  readonly key: string;
  readonly at: string;
};

export const described = (found: readonly Violation[]): string[] =>
  found.map(({ key, at }) => `${key} at ${at}`).sort();
