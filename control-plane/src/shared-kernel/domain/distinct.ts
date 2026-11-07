interface Comparable<T> {
  equals(other: T): boolean;
}

export const distinct = <T extends Comparable<T>>(items: readonly T[]): T[] =>
  items.filter(
    (each, at) => items.findIndex((other) => other.equals(each)) === at,
  );

export const repeatedIn = (names: readonly string[]): string | null =>
  names.find((each, at) => names.indexOf(each) !== at) ?? null;
