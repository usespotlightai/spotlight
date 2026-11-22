export const repositoryNameKey = (name: string | null): string | null =>
  name?.toLowerCase() ?? null;

export const sameRepositoryName = (
  one: string | null,
  other: string | null,
): boolean => repositoryNameKey(one) === repositoryNameKey(other);
