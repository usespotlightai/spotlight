import type { Adoption } from '@insights/domain/services/adoption';
import type {
  CacheUse,
  CostBreakdown,
  CostSlice,
  FlowLink,
  FlowNode,
  StationCacheUse,
} from '@insights/domain/services/cost-breakdown';
import type {
  ConfigMarker,
  DayOutput,
} from '@insights/domain/services/daily-output';
import type { Flow } from '@insights/domain/services/flow';
import type {
  Headline,
  HeadlineDeltas,
} from '@insights/domain/services/headline';
import type {
  HumanLoad,
  HumanLoadDeltas,
} from '@insights/domain/services/human-load';
import type { Spread } from '@insights/domain/services/measures';
import type {
  RunTally,
  TallyCounted,
  TallyDeltas,
  TallySeen,
} from '@insights/domain/services/run-tally';
import type { StationWorthImproving } from '@insights/domain/services/station-ranking';
import type {
  DayTally,
  StationReport,
} from '@insights/domain/services/station-reports';
import type { Delta } from '@insights/domain/value-objects/delta.vo';
import type {
  InsightsPeriod,
  InsightsPeriodName,
} from '@insights/domain/value-objects/insights-period.vo';

export type DeltaDto = Delta;

export type HeadlineDeltasDto = HeadlineDeltas;

export type TallyDeltasDto = TallyDeltas;

export type HumanLoadDeltasDto = HumanLoadDeltas;

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
  readonly headline: HeadlineDto;
  readonly changes: HeadlineDeltasDto;
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
  readonly tasksChange: DeltaDto | null;
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
    readonly opened: DeltaDto | null;
    readonly reviewed: DeltaDto | null;
    readonly merged: DeltaDto | null;
  };
}

export interface FlowDto {
  readonly stations: readonly StationFlowDto[];
  readonly delivery: DeliveryFlowDto;
}

export interface InsightsFlowDto {
  readonly period: PeriodDto;
  readonly flow: FlowDto;
}

export type StationReportDto = StationReport;

export interface InsightsStationsDto {
  readonly period: PeriodDto;
  readonly team: RunTally;
  readonly teamChanges: TallyDeltasDto;
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
  readonly actions: number;
  readonly chats: number;
  readonly firstSeenAt: string;
  readonly lastActiveAt: string;
  readonly isNew: boolean;
}

export interface AdoptionDto {
  readonly activeCount: number;
  readonly activeChange: DeltaDto | null;
  readonly newAdopterCount: number;
  readonly weeklyCount: number;
  readonly monthlyCount: number;
  readonly stickiness: number | null;
  readonly people: readonly PersonUseDto[];
}

export interface InsightsPeopleDto {
  readonly period: PeriodDto;
  readonly load: HumanLoadDto;
  readonly loadChanges: HumanLoadDeltasDto;
  readonly adoption: AdoptionDto;
}

export type CostBreakdownDto = CostBreakdown;

export type CostSliceDto = CostSlice;

export type CacheUseDto = CacheUse;

export type StationCacheUseDto = StationCacheUse;

export type FlowNodeDto = FlowNode;

export type FlowLinkDto = FlowLink;

export interface InsightsCostDto {
  readonly period: PeriodDto;
  readonly cost: CostBreakdownDto;
  readonly spendChange: DeltaDto | null;
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
