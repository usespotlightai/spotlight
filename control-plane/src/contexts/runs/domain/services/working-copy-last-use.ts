export interface WorkingCopyUse {
  readonly id: string;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
}

const usedAt = (use: WorkingCopyUse): number | null =>
  use.startedAt === null ? null : (use.endedAt ?? use.startedAt).getTime();

const usedLater = (one: WorkingCopyUse, other: WorkingCopyUse): boolean => {
  const [oneAt, otherAt] = [usedAt(one) ?? 0, usedAt(other) ?? 0];

  if (oneAt !== otherAt) {
    return oneAt > otherAt;
  }

  if (one.createdAt.getTime() !== other.createdAt.getTime()) {
    return one.createdAt.getTime() > other.createdAt.getTime();
  }

  return one.id > other.id;
};

export const lastUseOf = <U extends WorkingCopyUse>(
  uses: readonly U[],
): U | null =>
  uses
    .filter((each) => usedAt(each) !== null)
    .reduce<U | null>(
      (last, each) => (last === null || usedLater(each, last) ? each : last),
      null,
    );
