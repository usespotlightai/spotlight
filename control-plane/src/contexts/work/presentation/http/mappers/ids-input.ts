export const idsInput = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((each): each is string => typeof each === 'string')
    : [];
