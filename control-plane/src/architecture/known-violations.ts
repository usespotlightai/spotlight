export type Violation = {
  readonly key: string;
  readonly at: string;
};

type KnownViolation = {
  readonly count: number;
  readonly finding?: string;
};

export type KnownViolations = Readonly<Record<string, KnownViolation>>;

export const ratchetProblems = (
  found: readonly Violation[],
  known: KnownViolations,
): string[] => {
  const located = new Map<string, string[]>();

  for (const violation of found) {
    located.set(violation.key, [
      ...(located.get(violation.key) ?? []),
      violation.at,
    ]);
  }

  const added = [...located]
    .filter(([key, at]) => at.length > (known[key]?.count ?? 0))
    .map(
      ([key, at]) =>
        `new: ${key} (${at.length} found, ${known[key]?.count ?? 0} known) at ${at.join(', ')}`,
    );
  const fixed = Object.entries(known)
    .filter(([key, entry]) => (located.get(key)?.length ?? 0) < entry.count)
    .map(
      ([key, entry]) =>
        `fixed, lower or remove the known entry: ${key} (${located.get(key)?.length ?? 0} found, ${entry.count} known)`,
    );

  return [...added, ...fixed].sort();
};
