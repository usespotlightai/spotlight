import { isBlock } from '@replays/domain/value-objects/block-shape';

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (isBlock(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }

  return value;
};

const unsetIfEmpty = (value: unknown): unknown =>
  Array.isArray(value) && value.length === 0 ? undefined : value;

export const sameField = (
  one: unknown,
  other: unknown,
  options: { readonly emptyIsUnset?: boolean } = {},
): boolean => {
  const read = options.emptyIsUnset ? unsetIfEmpty : (value: unknown) => value;

  return (
    JSON.stringify(canonical(read(one)) ?? null) ===
    JSON.stringify(canonical(read(other)) ?? null)
  );
};
