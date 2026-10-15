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

const COST_PARTS = ['harness', 'model', 'station', 'repository'] as const;

type CostPart = (typeof COST_PARTS)[number];

export interface CostPlace {
  readonly run: number;
  readonly offset: number;
}

export interface CostShareCount {
  readonly part: CostPart;
  readonly key: string | null;
  readonly amount: number;
  readonly runs: number;
  readonly first: CostPlace;
}

interface FlowEnd {
  readonly kind: FlowNodeKind;
  readonly key: string | null;
}

export interface CostLinkCount {
  readonly source: FlowEnd;
  readonly target: FlowEnd;
  readonly amount: number;
  readonly first: CostPlace;
}

export interface CacheTotals {
  readonly input: number;
  readonly cacheRead: number;
  readonly cacheWrite: number | null;
}

interface StationCacheTotals {
  readonly stationId: string;
  readonly first: number;
  readonly cache: CacheTotals | null;
}

export interface CostCounts {
  readonly spend: Spend | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly shares: readonly CostShareCount[];
  readonly links: readonly CostLinkCount[];
  readonly cache: CacheTotals | null;
  readonly cacheByStation: readonly StationCacheTotals[];
}

export interface CostCountsInPeriod {
  readonly current: CostCounts;
  readonly spendBefore: Spend | null;
}

const repositorySharesOf = (each: Priced): readonly Share[] => {
  const repositories = each.record.end?.setup.repositories ?? [];

  return repositories.length === 0
    ? [{ key: null, amount: each.amount }]
    : repositories.map((key) => ({
        key,
        amount: each.amount / repositories.length,
      }));
};

const nodeId = ({ kind, key }: FlowEnd): string => `${kind}:${key ?? ''}`;

const cacheTotalsOf = (records: readonly RunRecord[]): CacheTotals | null => {
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
    return null;
  }

  const written = known.flatMap((each) =>
    each.cacheWrite === null ? [] : [each.cacheWrite],
  );

  return {
    input: known.reduce((sum, each) => sum + each.input, 0),
    cacheRead: known.reduce((sum, each) => sum + each.cacheRead, 0),
    cacheWrite:
      written.length > 0 ? written.reduce((sum, each) => sum + each, 0) : null,
  };
};

export const costCountsOf = (
  history: TeamHistory,
  window: Window,
): CostCounts => {
  const ran = endedWithin(history.records, window).filter((each) => each.ran);
  const spending = spendingOf(ran.map((each) => each.cost?.spend ?? null));
  const priced: Priced[] = ran.flatMap((record) =>
    record.cost?.spend ? [{ record, amount: record.cost.spend.amount }] : [],
  );
  const shares = new Map<string, CostShareCount>();
  const links = new Map<string, CostLinkCount>();
  const share = (
    part: CostPart,
    key: string | null,
    amount: number,
    first: CostPlace,
  ) => {
    const id = `${part}\u0000${key ?? ''}\u0000${key === null}`;
    const held = shares.get(id);
    shares.set(id, {
      part,
      key,
      amount: (held?.amount ?? 0) + amount,
      runs: (held?.runs ?? 0) + 1,
      first: held?.first ?? first,
    });
  };
  const link = (
    source: FlowEnd,
    target: FlowEnd,
    amount: number,
    first: CostPlace,
  ) => {
    const id = `${nodeId(source)}\u0000${nodeId(target)}`;
    const held = links.get(id);
    links.set(id, {
      source,
      target,
      amount: (held?.amount ?? 0) + amount,
      first: held?.first ?? first,
    });
  };

  for (const [index, each] of priced.entries()) {
    const end = each.record.end;

    if (!end) {
      continue;
    }

    const run = index + 1;
    const model: FlowEnd = { kind: 'model', key: end.setup.model };
    const station: FlowEnd = { kind: 'station', key: end.place.stationId };

    share('harness', end.setup.harness, each.amount, { run, offset: 0 });
    share('model', model.key, each.amount, { run, offset: 0 });
    share('station', station.key, each.amount, { run, offset: 1 });
    link(model, station, each.amount, { run, offset: 0 });

    for (const [position, repository] of repositorySharesOf(each).entries()) {
      share('repository', repository.key, repository.amount, {
        run,
        offset: 2 + position,
      });
      link(
        station,
        { kind: 'repository', key: repository.key },
        repository.amount,
        { run, offset: 1 + position },
      );
    }
  }

  const stations = new Map<string, { first: number; runs: RunRecord[] }>();

  for (const [index, each] of ran.entries()) {
    const stationId = each.end?.place.stationId;

    if (stationId) {
      const held = stations.get(stationId);
      stations.set(stationId, {
        first: held?.first ?? index + 1,
        runs: [...(held?.runs ?? []), each],
      });
    }
  }

  return {
    spend: spending.spend,
    unpriced: spending.unpriced,
    mixedCurrencies: spending.mixedCurrencies,
    shares: [...shares.values()],
    links: [...links.values()],
    cache: cacheTotalsOf(ran),
    cacheByStation: [...stations.entries()].map(([stationId, held]) => ({
      stationId,
      first: held.first,
      cache: cacheTotalsOf(held.runs),
    })),
  };
};

const cacheUseOf = (totals: CacheTotals | null): CacheUse =>
  totals
    ? {
        ...totals,
        cacheShare: rateOf(
          totals.cacheRead,
          totals.input + totals.cacheRead + (totals.cacheWrite ?? 0),
        ),
      }
    : { input: null, cacheRead: null, cacheWrite: null, cacheShare: null };

const inFirstOrder = <T extends { readonly first: CostPlace }>(
  items: readonly T[],
): T[] =>
  [...items].sort(
    (a, b) => a.first.run - b.first.run || a.first.offset - b.first.offset,
  );

export const costBreakdownFrom = (counts: CostCounts): CostBreakdown => {
  const priced = counts.spend !== null;
  const slicesOf = (part: CostPart): readonly CostSlice[] =>
    priced
      ? inFirstOrder(counts.shares.filter((each) => each.part === part))
          .sort((a, b) => b.amount - a.amount)
          .map(({ key, amount, runs }) => ({ key, amount, runs }))
      : [];

  return {
    spend: counts.spend,
    unpriced: counts.unpriced,
    mixedCurrencies: counts.mixedCurrencies,
    byHarness: slicesOf('harness'),
    byModel: slicesOf('model'),
    byStation: slicesOf('station'),
    byRepository: slicesOf('repository'),
    nodes: priced
      ? inFirstOrder(
          counts.shares.flatMap((each) =>
            each.part === 'harness' ? [] : [{ ...each, kind: each.part }],
          ),
        ).map(({ kind, key }) => ({ id: nodeId({ kind, key }), kind, key }))
      : [],
    links: priced
      ? inFirstOrder(counts.links).map((each) => ({
          source: nodeId(each.source),
          target: nodeId(each.target),
          amount: each.amount,
        }))
      : [],
    cache: cacheUseOf(counts.cache),
    cacheByStation: [...counts.cacheByStation]
      .sort((a, b) => a.first - b.first)
      .map((each) => ({
        stationId: each.stationId,
        ...cacheUseOf(each.cache),
      })),
  };
};
