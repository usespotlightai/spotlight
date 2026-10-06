const IN_A_ROW: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  7: 'lg:grid-cols-7',
};

export const tilesInARow = (count: number): string =>
  IN_A_ROW[count] ?? 'lg:grid-cols-4';
