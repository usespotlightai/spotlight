import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { Adoption } from '@outcomes/domain/services/adoption';
import type {
  CacheUse,
  CostBreakdown,
  CostSlice,
  FlowLink,
  FlowNode,
  StationCacheUse,
} from '@outcomes/domain/services/cost-breakdown';
import type {
  ConfigMarker,
  DayOutput,
} from '@outcomes/domain/services/daily-output';
import type { Flow } from '@outcomes/domain/services/flow';
import type {
  Headline,
  HeadlineChanges,
} from '@outcomes/domain/services/headline';
import type {
  HumanLoad,
  HumanLoadChanges,
} from '@outcomes/domain/services/human-load';
import type { Spread } from '@outcomes/domain/services/measures';
import type {
  RunTally,
  TallyChanges,
  TallyCounted,
  TallySeen,
} from '@outcomes/domain/services/run-tally';
import type { StationWorthImproving } from '@outcomes/domain/services/station-ranking';
import type {
  DayTally,
  StationReport,
} from '@outcomes/domain/services/station-reports';
import type { Change } from '@outcomes/domain/value-objects/change.vo';
import type { CheckVerdict } from '@outcomes/domain/value-objects/check-verdict';
import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import type {
  InsightsPeriod,
  InsightsPeriodName,
} from '@outcomes/domain/value-objects/insights-period.vo';
import type {
  Spend,
  TokenCounts,
} from '@outcomes/domain/value-objects/run-cost.vo';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';

export type ChangeDto = Change;

export type HeadlineChangesDto = HeadlineChanges;

export type TallyChangesDto = TallyChanges;

export type HumanLoadChangesDto = HumanLoadChanges;

export interface PeriodDto {
  readonly name: InsightsPeriodName;
  readonly from: string;
  readonly to: string;
  readonly previousFrom: string;
  readonly previousTo: string;
  readonly days: readonly string[];
}

export interface PersonNameDto {
  readonly personId: string;
  readonly name: string | null;
}

export interface SpreadDto {
  readonly p50Ms: number | null;
  readonly p90Ms: number | null;
  readonly count: number;
}

export type HeadlineDto = Omit<Headline, 'taskToMerge'> & {
  readonly taskToMerge: SpreadDto;
};

export type DayOutputDto = Omit<DayOutput, 'changes'> & {
  readonly changes: readonly ConfigMarkerDto[];
};

export type ConfigMarkerDto = Omit<ConfigMarker, 'firstRunAt'> & {
  readonly firstRunAt: string;
};

export type StationWorthImprovingDto = StationWorthImproving;

export interface InsightsOverviewDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly headline: HeadlineDto;
  readonly changes: HeadlineChangesDto;
  readonly output: readonly DayOutputDto[];
  readonly outputCurrency: string | null;
  readonly outputMixedCurrencies: boolean;
  readonly worthImproving: readonly StationWorthImprovingDto[];
  readonly people: readonly PersonNameDto[];
}

export interface StationFlowDto {
  readonly lineId: string;
  readonly stationId: string;
  readonly tasks: number;
  readonly tasksBefore: number;
  readonly tasksChange: ChangeDto | null;
  readonly taskIds: readonly string[];
  readonly runs: number;
  readonly queued: SpreadDto;
  readonly running: SpreadDto;
  readonly inbox: SpreadDto;
  readonly asks: number;
  readonly unanswered: number;
}

export interface DeliveryFlowDto {
  readonly toPullRequest: SpreadDto;
  readonly toFirstReview: SpreadDto;
  readonly toMerge: SpreadDto;
  readonly opened: number;
  readonly reviewed: number;
  readonly merged: number;
  readonly openedTaskIds: readonly string[];
  readonly reviewedTaskIds: readonly string[];
  readonly mergedTaskIds: readonly string[];
  readonly changes: {
    readonly opened: ChangeDto | null;
    readonly reviewed: ChangeDto | null;
    readonly merged: ChangeDto | null;
  };
}

export interface FlowDto {
  readonly stations: readonly StationFlowDto[];
  readonly delivery: DeliveryFlowDto;
}

export interface InsightsFlowDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly flow: FlowDto;
}

export type StationReportDto = StationReport;

export interface InsightsStationsDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly team: RunTally;
  readonly teamChanges: TallyChangesDto;
  readonly teamSeen: TallySeen;
  readonly teamCounted: TallyCounted;
  readonly teamTrend: readonly DayTally[];
  readonly stations: readonly StationReportDto[];
}

export type HumanLoadDto = Omit<HumanLoad, 'toAnswer'> & {
  readonly toAnswer: SpreadDto;
};

export interface PersonUseDto {
  readonly personId: string;
  readonly name: string | null;
  readonly tasksOpened: number;
  readonly acts: number;
  readonly chats: number;
  readonly firstSeenAt: string;
  readonly lastActiveAt: string;
  readonly isNew: boolean;
}

export interface AdoptionDto {
  readonly activeCount: number;
  readonly activeChange: ChangeDto | null;
  readonly newAdopterCount: number;
  readonly weeklyCount: number;
  readonly monthlyCount: number;
  readonly stickiness: number | null;
  readonly people: readonly PersonUseDto[];
}

export interface InsightsPeopleDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly load: HumanLoadDto;
  readonly loadChanges: HumanLoadChangesDto;
  readonly adoption: AdoptionDto;
}

export type CostBreakdownDto = CostBreakdown;

export type CostSliceDto = CostSlice;

export type CacheUseDto = CacheUse;

export type StationCacheUseDto = StationCacheUse;

export type FlowNodeDto = FlowNode;

export type FlowLinkDto = FlowLink;

export type TokenCountsDto = TokenCounts;

export interface InsightsCostDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly cost: CostBreakdownDto;
  readonly spendChange: ChangeDto | null;
}

export interface InsightsRunDto {
  readonly runId: string;
  readonly taskId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profileKey: string | null;
  readonly repositories: readonly string[];
  readonly openedBy: string | null;
  readonly queuedAt: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string;
  readonly queuedMs: number | null;
  readonly runningMs: number | null;
  readonly ms: number | null;
  readonly cost: Spend | null;
  readonly tokens: TokenCounts | null;
  readonly ending: RunEnding;
  readonly failure: string | null;
  readonly checks: CheckVerdict | null;
  readonly next: { readonly act: string; readonly at: string } | null;
  readonly handedOn: { readonly to: string; readonly at: string } | null;
  readonly delivery: DeliveryState | null;
}

export interface InsightsRunsDto {
  readonly period: PeriodDto;
  readonly total: number;
  readonly page: number;
  readonly size: number;
  readonly runs: readonly InsightsRunDto[];
  readonly people: readonly PersonNameDto[];
}

export const periodOf = (period: InsightsPeriod): PeriodDto => ({
  name: period.name,
  from: period.current.from.toISOString(),
  to: period.current.to.toISOString(),
  previousFrom: period.previous.from.toISOString(),
  previousTo: period.previous.to.toISOString(),
  days: period.days,
});

export const spreadDtoOf = (spread: Spread): SpreadDto => ({
  p50Ms: spread.p50,
  p90Ms: spread.p90,
  count: spread.count,
});

export const headlineDtoOf = (headline: Headline): HeadlineDto => ({
  ...headline,
  taskToMerge: spreadDtoOf(headline.taskToMerge),
});

const configMarkerDtoOf = (marker: ConfigMarker): ConfigMarkerDto => ({
  ...marker,
  firstRunAt: marker.firstRunAt.toISOString(),
});

export const dayOutputDtoOf = (day: DayOutput): DayOutputDto => ({
  ...day,
  changes: day.changes.map(configMarkerDtoOf),
});

export const flowDtoOf = (flow: Flow): FlowDto => ({
  stations: flow.stations.map((each) => ({
    ...each,
    queued: spreadDtoOf(each.queued),
    running: spreadDtoOf(each.running),
    inbox: spreadDtoOf(each.inbox),
  })),
  delivery: {
    ...flow.delivery,
    toPullRequest: spreadDtoOf(flow.delivery.toPullRequest),
    toFirstReview: spreadDtoOf(flow.delivery.toFirstReview),
    toMerge: spreadDtoOf(flow.delivery.toMerge),
  },
});

export const humanLoadDtoOf = (load: HumanLoad): HumanLoadDto => ({
  ...load,
  toAnswer: spreadDtoOf(load.toAnswer),
});

export const namedOf = (
  ids: readonly string[],
  names: ReadonlyMap<string, string>,
): readonly PersonNameDto[] =>
  [...new Set(ids)].sort().map((personId) => ({
    personId,
    name: names.get(personId) ?? null,
  }));

export const adoptionDtoOf = (
  adoption: Adoption,
  names: ReadonlyMap<string, string>,
): AdoptionDto => ({
  ...adoption,
  people: adoption.people.map((each) => ({
    ...each,
    name: names.get(each.personId) ?? null,
    firstSeenAt: each.firstSeenAt.toISOString(),
    lastActiveAt: each.lastActiveAt.toISOString(),
  })),
});

export const insightsRunOf = (
  record: RunRecord,
  openedBy: string | null,
  deliveries: ReadonlyMap<string, TaskDelivery>,
): InsightsRunDto | null => {
  const end = record.end;
  const ending = record.ending;

  if (!end || !ending) {
    return null;
  }

  return {
    runId: record.runId.value,
    taskId: end.place.taskId.value,
    lineId: end.place.lineId,
    stationId: end.place.stationId,
    fingerprint: end.fingerprint,
    harness: end.setup.harness,
    model: end.setup.model,
    effort: end.setup.effort,
    profileKey: end.setup.profileKey,
    repositories: end.setup.repositories,
    openedBy,
    queuedAt: end.queuedAt?.toISOString() ?? null,
    startedAt: end.startedAt?.toISOString() ?? null,
    endedAt: end.endedAt.toISOString(),
    queuedMs: end.queuedMs,
    runningMs: end.runningMs,
    ms: record.cost?.ms ?? null,
    cost: record.cost?.spend ?? null,
    tokens: record.cost?.tokens ?? null,
    ending,
    failure: end.failure,
    checks: record.checks,
    next: record.next
      ? { act: record.next.act, at: record.next.at.toISOString() }
      : null,
    handedOn: record.handedOn
      ? { to: record.handedOn.to, at: record.handedOn.at.toISOString() }
      : null,
    delivery: deliveries.get(end.place.taskId.value)?.state ?? null,
  };
};
