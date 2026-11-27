import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value !== null && typeof value === 'object') {
    const entries: [string, unknown][] = Object.entries(value);

    return Object.fromEntries(
      entries
        .filter(([, each]) => each !== undefined)
        .sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))
        .map(([key, each]) => [key, canonical(each)]),
    );
  }

  return value;
};

export const canonicalOrder = (order: RunOrderContract): string =>
  JSON.stringify(canonical(order));
