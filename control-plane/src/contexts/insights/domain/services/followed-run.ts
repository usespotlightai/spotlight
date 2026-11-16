import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { effectiveEndingOf } from '@insights/domain/services/run-classification';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';

const completedEndOf = (record: RunRecord): RunEnd | null =>
  record.end &&
  effectiveEndingOf(record.end, record.supersededAt) === 'completed'
    ? record.end
    : null;

const atSamePlace = (one: RunEnd, other: RunEnd): boolean =>
  one.location.taskId.equals(other.location.taskId) &&
  one.location.stationId.equals(other.location.stationId);

const endsAfter = (
  other: { record: RunRecord; end: RunEnd },
  one: { record: RunRecord; end: RunEnd },
): boolean => {
  const gap = other.end.endedAt.getTime() - one.end.endedAt.getTime();

  return (
    gap > 0 || (gap === 0 && other.record.runId.value > one.record.runId.value)
  );
};

export const followedAtOf = (
  record: RunRecord,
  records: readonly RunRecord[],
): Date | null => {
  const { end } = record;

  if (!end) {
    return null;
  }

  const later = records.flatMap((other) => {
    const otherEnd =
      other.runId.equals(record.runId) ||
      !other.workspaceId.equals(record.workspaceId)
        ? null
        : completedEndOf(other);

    return otherEnd &&
      atSamePlace(end, otherEnd) &&
      endsAfter({ record: other, end: otherEnd }, { record, end })
      ? [otherEnd.endedAt.getTime()]
      : [];
  });

  return later.length > 0 ? new Date(Math.min(...later)) : null;
};
