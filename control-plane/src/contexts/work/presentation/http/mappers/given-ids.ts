export const givenIds = (given: unknown): string[] =>
  Array.isArray(given)
    ? given.filter((each): each is string => typeof each === 'string')
    : [];
