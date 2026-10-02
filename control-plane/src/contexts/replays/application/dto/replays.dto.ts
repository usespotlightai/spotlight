import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface ReplaySetEntryDto {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string | null;
  readonly state: string | null;
  readonly endedAt: string | null;
  readonly addedAt: string;
  readonly refusal: string | null;
  readonly reason: string | null;
}

export interface ReplaySetDto {
  readonly id: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly name: string;
  readonly createdAt: string;
  readonly stationGone: boolean;
  readonly entries: readonly ReplaySetEntryDto[];
}

export interface ReplayableRunDto {
  readonly runId: string;
  readonly taskId: string | null;
  readonly title: string;
  readonly state: string;
  readonly endedAt: string;
  readonly refusal: string | null;
  readonly reason: string | null;
}

export interface SpendDto {
  readonly amount: number;
  readonly currency: string;
}

export interface ModelSpentDto {
  readonly spends: readonly SpendDto[];
  readonly unpriced: number;
}

export interface EntryReasonDto {
  readonly code: string;
  readonly detail: string | null;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
}

export interface EntryChecksDto {
  readonly state: string;
  readonly failedAt: readonly string[];
  readonly why: string | null;
}

export interface EntryJudgeDto {
  readonly state: 'asked' | 'judged' | 'unjudged';
  readonly scale: string | null;
  readonly score: number | null;
  readonly passed: boolean | null;
  readonly referenced: boolean | null;
  readonly model: string | null;
  readonly unjudged: string | null;
}

export type EntryResultDto = 'pending' | 'succeeded' | 'failed' | 'unscored';

export interface ReplayEntryDto {
  readonly position: number;
  readonly originalRunId: string;
  readonly taskId: string;
  readonly runId: string | null;
  readonly fingerprint: string | null;
  readonly phase: 'waiting' | 'dispatched' | 'settled';
  readonly ending: string | null;
  readonly refusal: string | null;
  readonly failure: string | null;
  readonly next: string | null;
  readonly ms: number | null;
  readonly steps: number | null;
  readonly cost: SpendDto | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly checks: EntryChecksDto | null;
  readonly judge: EntryJudgeDto | null;
  readonly draftingSpent: ModelSpentDto | null;
  readonly judgingSpent: ModelSpentDto | null;
  readonly result: EntryResultDto;
  readonly succeeded: boolean | null;
  readonly reasons: readonly EntryReasonDto[];
}

export interface ReplayTotalsDto {
  readonly entries: number;
  readonly settled: number;
  readonly completed: number;
  readonly failed: number;
  readonly stopped: number;
  readonly asked: number;
  readonly unreplayable: number;
  readonly notRun: number;
  readonly succeeded: number | null;
  readonly successRate: number | null;
  readonly scored: number;
  readonly unscored: number;
  readonly spent: SpendDto;
  readonly spentElsewhere: readonly SpendDto[];
  readonly unpriced: number;
  readonly unpricedCalls: number;
  readonly steps: number;
  readonly medianSteps: number | null;
  readonly ms: number;
  readonly medianMs: number | null;
}

export interface CandidateDto {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly fingerprint: string;
  readonly station: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface ReplayDto {
  readonly id: string;
  readonly setId: string;
  readonly candidate: CandidateDto | null;
  readonly startedAsBaseline: boolean;
  readonly isBaseline: boolean;
  readonly judges: boolean;
  readonly checks: boolean;
  readonly state: string;
  readonly ceiling: SpendDto;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly totals: ReplayTotalsDto;
  readonly entries: readonly ReplayEntryDto[];
}

export interface EntryComparisonDto {
  readonly originalRunId: string;
  readonly taskId: string;
  readonly title: string | null;
  readonly candidate: ReplayEntryDto;
  readonly baseline: ReplayEntryDto | null;
  readonly costDelta: number | null;
  readonly msDelta: number | null;
  readonly stepsDelta: number | null;
  readonly scoreDelta: number | null;
  readonly scoreUncompared: string | null;
  readonly regressed: boolean;
}

export interface ReplayDetailDto extends ReplayDto {
  readonly baselineReplayId: string | null;
  readonly comparison: readonly EntryComparisonDto[];
}

export interface ReplayOfRunDto {
  readonly replayId: string;
  readonly setId: string;
  readonly setName: string | null;
  readonly lineId: string;
  readonly stationId: string;
  readonly candidate: CandidateDto | null;
  readonly startedAsBaseline: boolean;
  readonly isBaseline: boolean;
  readonly state: string;
  readonly entry: ReplayEntryDto | null;
}

export interface StationChangeDto {
  readonly part: string;
  readonly name: string | null;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly was: string | null;
  readonly now: string | null;
}

export interface CandidateResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly warnings: readonly ConfigurationProblem[];
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly stationAddress: string;
  readonly name: string;
  readonly kind: string;
  readonly station: Readonly<Record<string, unknown>>;
  readonly fingerprint: string;
  readonly changedFrom: {
    readonly fingerprint: string;
    readonly changes: readonly StationChangeDto[];
  };
  readonly createdAt: string;
}
