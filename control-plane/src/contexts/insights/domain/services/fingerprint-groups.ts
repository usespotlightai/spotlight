import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { lastConfigsOf } from '@insights/domain/services/config-intervals';
import { inStartOrder, startOf } from '@insights/domain/services/run-order';
import { dayOf } from '@insights/domain/value-objects/insights-period.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface FingerprintGroup {
  readonly fingerprint: string | null;
  readonly ran: boolean;
  readonly previous: string | null;
  readonly firstRunId: RunId;
  readonly records: readonly RunRecord[];
}

interface Gathering {
  readonly fingerprint: string | null;
  readonly ran: boolean;
  readonly previous: string | null;
  readonly firstRunId: RunId;
  readonly records: RunRecord[];
}

export const fingerprintGroupsNewestFirst = (
  records: readonly RunRecord[],
  before: readonly RunRecord[] = [],
): readonly FingerprintGroup[] => {
  const inForce = lastConfigsOf(before);
  const groups: Gathering[] = [];

  for (const record of [...records].sort((one, other) =>
    inStartOrder(startOf(one), startOf(other)),
  )) {
    const stationId = record.end?.location.stationId ?? '';
    const intended = record.end?.fingerprint ?? null;
    const running = inForce.get(stationId) ?? null;
    const last = groups[groups.length - 1];
    const open = (fingerprint: string | null, ran: boolean): void => {
      groups.push({
        fingerprint,
        ran,
        previous: running,
        firstRunId: record.runId,
        records: [record],
      });
    };

    if (record.end?.ranItsConfig && intended !== null) {
      if (last?.ran && last.fingerprint === intended) {
        last.records.push(record);
      } else {
        open(intended, true);
      }
      inForce.set(stationId, intended);
    } else if (intended !== null && intended !== running) {
      if (last && !last.ran && last.fingerprint === intended) {
        last.records.push(record);
      } else {
        open(intended, false);
      }
    } else if (last?.ran) {
      last.records.push(record);
    } else {
      open(running, true);
    }
  }

  return groups
    .map((group) => ({ ...group, records: [...group.records].reverse() }))
    .reverse();
};

export interface ConfigInForce {
  readonly fingerprint: string;
  readonly firstRunId: RunId;
  readonly records: readonly RunRecord[];
}

export const configInForce = (
  newestFirst: readonly FingerprintGroup[],
): ConfigInForce | null => {
  const at = newestFirst.findIndex(
    (group) => group.ran && group.fingerprint !== null,
  );
  const newest = newestFirst[at];

  if (!newest?.fingerprint) {
    return null;
  }

  let oldest = newest;
  const records: RunRecord[] = [];

  for (const group of newestFirst.slice(at)) {
    if (!group.ran) {
      continue;
    }
    if (group.fingerprint !== newest.fingerprint) {
      break;
    }
    oldest = group;
    records.push(...group.records);
  }

  return {
    fingerprint: newest.fingerprint,
    firstRunId: oldest.firstRunId,
    records,
  };
};

export interface DaySpan {
  readonly firstDay: string | null;
  readonly lastDay: string | null;
}

export const daySpanOf = (records: readonly RunRecord[]): DaySpan => {
  const days = records
    .flatMap((each) => (each.end ? [dayOf(each.end.endedAt)] : []))
    .sort();

  return { firstDay: days[0] ?? null, lastDay: days[days.length - 1] ?? null };
};
