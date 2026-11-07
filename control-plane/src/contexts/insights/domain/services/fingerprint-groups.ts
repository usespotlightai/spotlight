import { lastConfigsOf } from '@insights/domain/services/config-intervals';
import { inStartOrder, startOf } from '@insights/domain/services/run-order';
import { dayOf } from '@insights/domain/value-objects/insights-period.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface FingerprintGroup {
  readonly fingerprint: string | null;
  readonly ran: boolean;
  readonly previous: string | null;
  readonly firstRunId: RunId;
  readonly records: readonly RunFact[];
}

interface Gathering {
  readonly fingerprint: string | null;
  readonly ran: boolean;
  readonly previous: string | null;
  readonly firstRunId: RunId;
  readonly records: RunFact[];
}

export const fingerprintGroupsNewestFirst = (
  records: readonly RunFact[],
  before: readonly RunFact[] = [],
): readonly FingerprintGroup[] => {
  const inForce = lastConfigsOf(before);
  const groups: Gathering[] = [];

  for (const record of [...records].sort((one, other) =>
    inStartOrder(startOf(one), startOf(other)),
  )) {
    const stationId = record.end.location.stationId.value;
    const intended = record.end.fingerprint;
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

    if (record.end.ranAConfig && intended !== null) {
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
  readonly records: readonly RunFact[];
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
  const records: RunFact[] = [];

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

export const daySpanOf = (records: readonly RunFact[]): DaySpan => {
  const days = records.map((each) => dayOf(each.end.endedAt)).sort();

  return { firstDay: days[0] ?? null, lastDay: days[days.length - 1] ?? null };
};
