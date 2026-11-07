import { rateOf } from '@insights/domain/services/measures';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';

export interface CostSlice {
  readonly key: string | null;
  readonly amount: number;
  readonly share: number | null;
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
  readonly cacheRate: number | null;
}

export interface StationCacheUse extends CacheUse {
  readonly stationId: string;
}

export interface CostBreakdown {
  readonly spend: Money | null;
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
  readonly spend: Money | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly shares: readonly CostShareCount[];
  readonly links: readonly CostLinkCount[];
  readonly cache: CacheTotals | null;
  readonly cacheByStation: readonly StationCacheTotals[];
}

export interface CostCountsInPeriod {
  readonly current: CostCounts;
  readonly spendBefore: Money | null;
}

const nodeId = ({ kind, key }: FlowEnd): string => `${kind}:${key ?? ''}`;

const cacheUseOf = (totals: CacheTotals | null): CacheUse =>
  totals
    ? {
        ...totals,
        cacheRate: rateOf(
          totals.cacheRead,
          totals.input + totals.cacheRead + (totals.cacheWrite ?? 0),
        ),
      }
    : { input: null, cacheRead: null, cacheWrite: null, cacheRate: null };

const inFirstOrder = <T extends { readonly first: CostPlace }>(
  items: readonly T[],
): T[] =>
  [...items].sort(
    (a, b) => a.first.run - b.first.run || a.first.offset - b.first.offset,
  );

const STAGES: Record<FlowNodeKind, number> = {
  model: 0,
  station: 1,
  repository: 2,
};

const byStageThenAmount = <
  T extends { readonly amount: number; readonly first: CostPlace },
>(
  stageOf: (item: T) => number,
  items: readonly T[],
): T[] =>
  inFirstOrder(items).sort(
    (a, b) => stageOf(a) - stageOf(b) || b.amount - a.amount,
  );

const byInputSpent = (
  stations: readonly StationCacheTotals[],
): StationCacheTotals[] =>
  [...stations]
    .sort((a, b) => a.first - b.first)
    .sort((a, b) => (b.cache?.input ?? -1) - (a.cache?.input ?? -1));

export const costBreakdownFrom = (counts: CostCounts): CostBreakdown => {
  const { spend } = counts;
  const priced = spend !== null;
  const slicesOf = (part: CostPart): readonly CostSlice[] =>
    spend
      ? inFirstOrder(counts.shares.filter((each) => each.part === part))
          .sort((a, b) => b.amount - a.amount)
          .map(({ key, amount, runs }) => ({
            key,
            amount,
            share: rateOf(amount, spend.amount),
            runs,
          }))
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
      ? byStageThenAmount(
          (each) => STAGES[each.kind],
          counts.shares.flatMap((each) =>
            each.part === 'harness' ? [] : [{ ...each, kind: each.part }],
          ),
        ).map(({ kind, key }) => ({ id: nodeId({ kind, key }), kind, key }))
      : [],
    links: priced
      ? byStageThenAmount((each) => STAGES[each.source.kind], counts.links).map(
          (each) => ({
            source: nodeId(each.source),
            target: nodeId(each.target),
            amount: each.amount,
          }),
        )
      : [],
    cache: cacheUseOf(counts.cache),
    cacheByStation: byInputSpent(counts.cacheByStation).map((each) => ({
      stationId: each.stationId,
      ...cacheUseOf(each.cache),
    })),
  };
};
