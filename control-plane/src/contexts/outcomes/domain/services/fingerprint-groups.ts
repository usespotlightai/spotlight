import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';

export interface FingerprintGroup {
  readonly fingerprint: string | null;
  readonly records: readonly RunRecord[];
}

const fingerprintOf = (record: RunRecord): string | null =>
  record.end?.fingerprint ?? null;

const endedAt = (record: RunRecord): number =>
  record.end?.endedAt.getTime() ?? 0;

export const fingerprintGroupsNewestFirst = (
  records: readonly RunRecord[],
): readonly FingerprintGroup[] => {
  const newestFirst = records
    .filter((each) => each.hasEnded)
    .sort((a, b) => endedAt(b) - endedAt(a));
  const groups: { fingerprint: string | null; records: RunRecord[] }[] = [];

  for (const record of newestFirst) {
    const fingerprint = fingerprintOf(record);
    const current = groups[groups.length - 1];

    if (current && current.fingerprint === fingerprint) {
      current.records.push(record);
    } else {
      groups.push({ fingerprint, records: [record] });
    }
  }

  return groups;
};
