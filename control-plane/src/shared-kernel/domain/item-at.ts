export const itemAt = <T>(items: readonly T[], index: number): T | undefined =>
  items[index];

export const firstOf = <T>(items: readonly T[]): T | undefined =>
  itemAt(items, 0);
