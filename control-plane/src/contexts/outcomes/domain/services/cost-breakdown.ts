import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { rateOf, spendingOf } from '@outcomes/domain/services/measures';
import {
  endedWithin,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export interface CostSlice {
  readonly key: string | null;
  readonly amount: number;
  readonly runs: number;
}

export const FLOW_NODE_KINDS = ['model', 'station', 'repository'] as const;

type FlowNodeKind = (typeof FLOW_NODE_KINDS)[number];

export interface FlowNode {
  readonly id: string;
  readonly kind: FlowNodeKind;
  readonly key: string | null;
}

export interface FlowLink {
  readonly source: string;
  readonly target: string;
  readonly amount: number;
}

export interface CacheUse {
  readonly input: number | null;
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
  readonly cacheShare: number | null;
}

export interface StationCacheUse extends CacheUse {
  readonly stationId: string;
}

export interface CostBreakdown {
  readonly spend: Spend | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly byHarness: readonly CostSlice[];
  readonly byModel: readonly CostSlice[];
  readonly byStation: readonly CostSlice[];
  readonly byRepository: readonly CostSlice[];
  readonly nodes: readonly FlowNode[];
  readonly links: readonly FlowLink[];
  readonly cache: CacheUse;
  readonly cacheByStation: readonly StationCacheUse[];
}

interface Priced {
  readonly record: RunRecord;
  readonly amount: number;
}

interface Share {
  readonly key: string | null;
  readonly amount: number;
}

const sliced = (
  priced: readonly Priced[],
  sharesOf: (each: Priced) => readonly Share[],
): readonly CostSlice[] => {
  const slices = new Map<string | null, { amount: number; runs: number }>();

  for (const each of priced) {
    for (const share of sharesOf(each)) {
      const held = slices.get(share.key) ?? { amount: 0, runs: 0 };
      slices.set(share.key, {
        amount: held.amount + share.amount,
        runs: held.runs + 1,
      });
    }
  }

  return [...slices.entries()]
    .map(([key, slice]) => ({ key, ...slice }))
    .sort((a, b) => b.amount - a.amount);
};

const repositorySharesOf = (each: Priced): readonly Share[] => {
  const repositories = each.record.end?.setup.repositories ?? [];

  return repositories.length === 0
    ? [{ key: null, amount: each.amount }]
    : repositories.map((key) => ({
        key,
        amount: each.amount / repositories.length,
      }));
};

const nodeId = (kind: FlowNodeKind, key: string | null): string =>
  `${kind}:${key ?? ''}`;

const linked = (
  priced: readonly Priced[],
): { nodes: FlowNode[]; links: FlowLink[] } => {
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  const node = (kind: FlowNodeKind, key: string | null): string => {
    const id = nodeId(kind, key);
    nodes.set(id, { id, kind, key });
    return id;
  };
  const link = (source: string, target: string, amount: number) => {
    const key = `${source}\u0000${target}`;
    const held = links.get(key);
    links.set(key, {
      source,
      target,
      amount: (held?.amount ?? 0) + amount,
    });
  };

  for (const each of priced) {
    const end = each.record.end;

    if (!end) {
      continue;
    }

    const model = node('model', end.setup.model);
    const station = node('station', end.place.stationId);
    link(model, station, each.amount);

    for (const share of repositorySharesOf(each)) {
      link(station, node('repository', share.key), share.amount);
    }
  }

  return { nodes: [...nodes.values()], links: [...links.values()] };
};

const cacheUseOf = (records: readonly RunRecord[]): CacheUse => {
  const known = records.flatMap((each) => {
    const tokens = each.cost?.tokens;

    return tokens && tokens.input !== null && tokens.cacheRead !== null
      ? [
          {
            input: tokens.input,
            cacheRead: tokens.cacheRead,
            cacheWrite: tokens.cacheWrite,
          },
        ]
      : [];
  });

  if (known.length === 0) {
    return { input: null, cacheRead: null, cacheWrite: null, cacheShare: null };
  }

  const input = known.reduce((sum, each) => sum + each.input, 0);
  const cacheRead = known.reduce((sum, each) => sum + each.cacheRead, 0);
  const written = known.flatMap((each) =>
    each.cacheWrite === null ? [] : [each.cacheWrite],
  );
  const cacheWrite =
    written.length > 0 ? written.reduce((sum, each) => sum + each, 0) : null;

  return {
    input,
    cacheRead,
    cacheWrite,
    cacheShare: rateOf(cacheRead, input + cacheRead + (cacheWrite ?? 0)),
  };
};

const cacheByStationOf = (
  records: readonly RunRecord[],
): readonly StationCacheUse[] => {
  const stations = new Map<string, RunRecord[]>();

  for (const each of records) {
    const stationId = each.end?.place.stationId;

    if (stationId) {
      stations.set(stationId, [...(stations.get(stationId) ?? []), each]);
    }
  }

  return [...stations.entries()].map(([stationId, here]) => ({
    stationId,
    ...cacheUseOf(here),
  }));
};

export const costBreakdownOf = (
  history: TeamHistory,
  window: Window,
): CostBreakdown => {
  const ran = endedWithin(history.records, window).filter((each) => each.ran);
  const spending = spendingOf(ran.map((each) => each.cost?.spend ?? null));
  const priced: Priced[] = spending.spend
    ? ran.flatMap((record) =>
        record.cost?.spend
          ? [{ record, amount: record.cost.spend.amount }]
          : [],
      )
    : [];
  const flows = linked(priced);

  return {
    spend: spending.spend,
    unpriced: spending.unpriced,
    mixedCurrencies: spending.mixedCurrencies,
    byHarness: sliced(priced, (each) => [
      { key: each.record.end?.setup.harness ?? null, amount: each.amount },
    ]),
    byModel: sliced(priced, (each) => [
      { key: each.record.end?.setup.model ?? null, amount: each.amount },
    ]),
    byStation: sliced(priced, (each) => [
      { key: each.record.end?.place.stationId ?? null, amount: each.amount },
    ]),
    byRepository: sliced(priced, repositorySharesOf),
    nodes: flows.nodes,
    links: flows.links,
    cache: cacheUseOf(ran),
    cacheByStation: cacheByStationOf(ran),
  };
};
