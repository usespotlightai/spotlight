export const groupedBy = <T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, T[]> => {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const group = groups.get(keyOf(item));

    if (group) {
      group.push(item);
    } else {
      groups.set(keyOf(item), [item]);
    }
  }

  return groups;
};
