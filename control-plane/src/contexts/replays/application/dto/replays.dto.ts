import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface ReplaySetEntryDto {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string | null;
  readonly state: string | null;
  readonly endedAt: string | null;
  readonly addedAt: string;
  readonly unreplayableReason: string | null;
  readonly reason: string | null;
  readonly outcome: OriginalOutcome;
  readonly origin: string | null;
}

export interface OutcomeCountDto {
  readonly outcome: OriginalOutcome;
  readonly count: number;
}

export interface OriginCountDto {
  readonly origin: string;
  readonly count: number;
}

export interface BalanceWarningDto {
  readonly dominant: OriginalOutcome;
  readonly count: number;
  readonly entries: number;
}

export interface SetCompositionDto {
  readonly outcomes: readonly OutcomeCountDto[];
  readonly origins: readonly OriginCountDto[];
  readonly oldest: string | null;
  readonly median: string | null;
  readonly newest: string | null;
  readonly balanceWarning: BalanceWarningDto | null;
}

export interface RateIntervalDto {
  readonly rate: number;
  readonly low: number;
  readonly high: number;
}

export interface GainEstimateDto {
  readonly gain: number;
  readonly low: number;
  readonly high: number;
  readonly significance: 'better' | 'worse' | 'within-noise';
  readonly minGain: number;
  readonly tasks: number;
}

export interface SetNoiseDto {
  readonly replayId: string;
  readonly fingerprint: string;
  readonly repeats: number;
  readonly perRepeat: readonly number[];
  readonly spread: number;
  readonly flippedTasks: readonly string[];
  readonly measuredAt: string;
  readonly noisyInOneRepeat: boolean;
}

export interface SetSaturationDto {
  readonly replayId: string;
  readonly rate: number;
  readonly interval: RateIntervalDto | null;
  readonly saturated: boolean;
  readonly measuredAt: string;
}

export interface JudgeConsistencyDto {
  readonly replayId: string;
  readonly compared: number;
  readonly agreed: number;
  readonly pending: number;
  readonly agreement: number | null;
  readonly unstable: boolean;
}

export interface FlakyCheckDto {
  readonly taskId: string;
  readonly originalRunId: string;
  readonly runId: string;
  readonly first: string;
  readonly recheck: string;
}

export interface CheckConsistencyDto {
  readonly replayId: string;
  readonly rechecked: number;
  readonly pending: number;
  readonly flaky: readonly FlakyCheckDto[];
}

export interface OracleReadingDto {
  readonly replayId: string;
  readonly candidateId: string;
  readonly repeats: number;
  readonly state: string;
  readonly referenceReplayId: string | null;
  readonly referenceState: string | null;
  readonly answered: number;
  readonly live: number | null;
  readonly withAnswer: number | null;
  readonly gain: GainEstimateDto | null;
  readonly roomToImprove: boolean | null;
}

export interface SetHealthDto {
  readonly noise: SetNoiseDto | null;
  readonly saturation: SetSaturationDto | null;
  readonly judge: JudgeConsistencyDto | null;
  readonly checks: CheckConsistencyDto | null;
  readonly oracle: OracleReadingDto | null;
}

export interface RefreshedRunDto {
  readonly runId: string;
  readonly title: string | null;
}

export interface SetRefreshDto {
  readonly at: string;
  readonly added: readonly RefreshedRunDto[];
  readonly removed: readonly RefreshedRunDto[];
}

export interface SearchSkipDto {
  readonly reason: string;
  readonly at: string;
}

export interface SearchScheduleDto {
  readonly lastStartedAt: string | null;
  readonly lastSkip: SearchSkipDto | null;
  readonly lastImprovedAt: string | null;
  readonly checkAfter: string;
  readonly minimumTasks: number;
}

export interface ReplaySetDto {
  readonly id: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly createdAt: string;
  readonly refreshedAt: string | null;
  readonly lastRefresh: SetRefreshDto | null;
  readonly stationGone: boolean;
  readonly health: SetHealthDto;
  readonly minGain: number;
  readonly composition: SetCompositionDto;
  readonly entries: readonly ReplaySetEntryDto[];
  readonly searchSchedule: SearchScheduleDto | null;
}

export interface MoneyDto {
  readonly amount: number;
  readonly currency: string;
}

export interface ModelSpentDto {
  readonly spends: readonly MoneyDto[];
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
  readonly state: 'requested' | 'judged' | 'unjudged';
  readonly scale: string | null;
  readonly score: number | null;
  readonly passed: boolean | null;
  readonly referenced: boolean | null;
  readonly model: string | null;
  readonly unjudged: string | null;
  readonly claimResults: readonly boolean[] | null;
  readonly claims: readonly string[];
  readonly passThreshold: number | null;
  readonly reasons: readonly EntryJudgeReasonDto[];
}

export interface EntryCitedStepDto {
  readonly index: number;
  readonly kind: string | null;
  readonly tool: string | null;
  readonly text: string | null;
}

export interface EntryCitedHunkDto {
  readonly id: string;
  readonly path: string | null;
  readonly header: string | null;
  readonly lines: readonly string[];
}

export interface EntryCitationDto {
  readonly kind: 'step' | 'hunk';
  readonly step: EntryCitedStepDto | null;
  readonly hunk: EntryCitedHunkDto | null;
}

export interface EntryJudgeReasonDto {
  readonly text: string;
  readonly claim: number | null;
  readonly citations: readonly EntryCitationDto[];
}

export interface EntryPairReasonDto {
  readonly text: string;
  readonly ownHunks: readonly string[];
  readonly theirHunks: readonly string[];
}

export interface EntryPairPassDto {
  readonly ownShownFirst: boolean;
  readonly outcome: 'win' | 'loss' | 'tie';
  readonly reasons: readonly EntryPairReasonDto[];
}

export interface EntryPairDto {
  readonly state: 'requested' | 'judged' | 'unpaired';
  readonly otherRunId: string;
  readonly outcome: 'win' | 'loss' | 'tie' | null;
  readonly model: string | null;
  readonly unpaired: string | null;
  readonly passes: readonly EntryPairPassDto[];
}

export interface PairTallyDto {
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
}

export type EntryResultDto = 'pending' | 'succeeded' | 'failed' | 'unscored';

export interface ReplayEntryDto {
  readonly position: number;
  readonly originalRunId: string;
  readonly taskId: string;
  readonly repeat: number;
  readonly runId: string | null;
  readonly fingerprint: string | null;
  readonly phase: 'waiting' | 'dispatched' | 'ended';
  readonly ending: string | null;
  readonly unreplayableReason: string | null;
  readonly failure: string | null;
  readonly next: string | null;
  readonly ms: number | null;
  readonly steps: number | null;
  readonly cost: MoneyDto | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly checks: EntryChecksDto | null;
  readonly judge: EntryJudgeDto | null;
  readonly generationSpent: ModelSpentDto | null;
  readonly judgingSpent: ModelSpentDto | null;
  readonly secondJudge: EntryJudgeDto | null;
  readonly rejudgingSpent: ModelSpentDto | null;
  readonly recheck: EntryChecksDto | null;
  readonly pair: EntryPairDto | null;
  readonly pairingSpent: ModelSpentDto | null;
  readonly result: EntryResultDto;
  readonly succeeded: boolean | null;
  readonly reasons: readonly EntryReasonDto[];
}

export interface ReplayTotalsDto {
  readonly entries: number;
  readonly ended: number;
  readonly completed: number;
  readonly failed: number;
  readonly stopped: number;
  readonly asked: number;
  readonly unreplayable: number;
  readonly notRun: number;
  readonly succeeded: number | null;
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
  readonly scored: number;
  readonly tasks: number;
  readonly tasksScored: number;
  readonly unscored: number;
  readonly spent: MoneyDto;
  readonly spentElsewhere: readonly MoneyDto[];
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

export interface ReplayReferenceDto {
  readonly replayId: string;
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
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
  readonly ceiling: MoneyDto;
  readonly repeats: number;
  readonly calibration: boolean;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly totals: ReplayTotalsDto;
  readonly gainOverReference: GainEstimateDto | null;
  readonly referenceReplay: ReplayReferenceDto | null;
  readonly pairwiseReference: string | null;
  readonly referencePairs: PairTallyDto | null;
  readonly entries: readonly ReplayEntryDto[];
}

export interface EntryComparisonDto {
  readonly originalRunId: string;
  readonly taskId: string;
  readonly title: string | null;
  readonly candidate: readonly ReplayEntryDto[];
  readonly baseline: readonly ReplayEntryDto[];
  readonly candidateSuccess: number | null;
  readonly baselineSuccess: number | null;
  readonly costDelta: number | null;
  readonly msDelta: number | null;
  readonly stepsDelta: number | null;
  readonly scoreDelta: number | null;
  readonly scoreUncompared: string | null;
  readonly regressed: boolean;
  readonly pair: 'win' | 'loss' | 'tie' | null;
}

export interface ReplaySearchDto {
  readonly searchId: string;
  readonly candidateName: string;
}

export interface ReplayDetailDto extends ReplayDto {
  readonly search: ReplaySearchDto | null;
  readonly baselineReplayId: string | null;
  readonly comparison: readonly EntryComparisonDto[];
}

export interface ReplayOfRunDto {
  readonly replayId: string;
  readonly setId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly candidate: CandidateDto | null;
  readonly startedAsBaseline: boolean;
  readonly isBaseline: boolean;
  readonly state: string;
  readonly search: ReplaySearchDto | null;
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
  readonly stationPath: string;
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
