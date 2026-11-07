import type { ChecksState } from '@replays/domain/value-objects/change-checks.vo';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { PairOutcome } from '@replays/domain/value-objects/entry-pairing.vo';
import type { EntryReason } from '@replays/domain/value-objects/entry-reason';
import type { HealthSampleGroup } from '@replays/domain/value-objects/health-sample-group.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ReplayEnding } from '@replays/domain/value-objects/replay-ending';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { RubricVersion } from '@replays/domain/value-objects/rubric-version.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { JudgeScaleKind } from '@shared-kernel/domain/value-objects/judge-scale.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface OutcomeMeasures {
  readonly steps: number;
  readonly ms: number | null;
  readonly cost: Money | null;
}

export interface OutcomeVerdict {
  readonly value: number;
  readonly scale: JudgeScaleKind;
  readonly referenced: boolean;
}

export interface OutcomeChecks {
  readonly state: ChecksState;
  readonly pending: boolean;
}

export interface OutcomeJudging {
  readonly pending: boolean;
}

export interface EntryOutcome {
  readonly position: number;
  readonly original: RunId;
  readonly taskId: TaskId;
  readonly repeat: number;
  readonly run: RunId | null;
  readonly hasEnded: boolean;
  readonly ending: ReplayEnding | null;
  readonly concluded: boolean;
  readonly succeeded: boolean | null;
  readonly reasons: readonly EntryReason[];
  readonly measures: OutcomeMeasures | null;
  readonly verdict: OutcomeVerdict | null;
  readonly pair: PairOutcome | null;
  readonly secondJudging: OutcomeJudging | null;
  readonly judgeAgreed: boolean | null;
  readonly checks: OutcomeChecks | null;
  readonly recheck: OutcomeChecks | null;
  readonly checksFlipped: boolean | null;
  readonly spent: ModelSpent;
}

export interface ReplayOutcomeState {
  readonly id: ReplayId;
  readonly setId: ReplaySetId;
  readonly candidateId: CandidateId;
  readonly searchId: SearchId | null;
  readonly current: ReplayState;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly repeats: number;
  readonly calibration: boolean;
  readonly servesAsBaseline: boolean;
  readonly healthSampleGroup: HealthSampleGroup | null;
  readonly sampledAt: Date;
  readonly rubricVersion: RubricVersion | null;
  readonly currency: string;
  readonly runSubset: readonly RunId[] | null;
  readonly referenceReplayId: ReplayId | null;
  readonly pairwiseReferenceId: ReplayId | null;
  readonly originals: readonly RunId[];
  readonly entries: readonly EntryOutcome[];
}

export interface OutcomeSpend {
  readonly spent: Money;
  readonly spentElsewhere: readonly Money[];
  readonly unpricedCalls: number;
}

export const spendOf = (spends: readonly ModelSpent[]): ModelSpent =>
  spends.reduce((total, each) => total.plus(each), ModelSpent.none());

export const spentIn = (spent: ModelSpent, currency: string): Money =>
  spent.spends.find((each) => each.currency === currency) ??
  Money.none(currency);

export const spentElsewhereIn = (
  spent: ModelSpent,
  currency: string,
): readonly Money[] =>
  spent.spends
    .filter((each) => each.currency !== currency)
    .sort((one, other) => (one.currency < other.currency ? -1 : 1));

export class ReplayOutcome {
  private constructor(private readonly state: ReplayOutcomeState) {}

  static of(state: ReplayOutcomeState): ReplayOutcome {
    return new ReplayOutcome({
      ...state,
      runSubset: state.runSubset && [...state.runSubset],
      originals: [...state.originals],
      entries: [...state.entries],
    });
  }

  get id(): ReplayId {
    return this.state.id;
  }

  get setId(): ReplaySetId {
    return this.state.setId;
  }

  get candidateId(): CandidateId {
    return this.state.candidateId;
  }

  get searchId(): SearchId | null {
    return this.state.searchId;
  }

  get current(): ReplayState {
    return this.state.current;
  }

  get startedAt(): Date {
    return this.state.startedAt;
  }

  get endedAt(): Date | null {
    return this.state.endedAt;
  }

  get repeats(): number {
    return this.state.repeats;
  }

  get calibration(): boolean {
    return this.state.calibration;
  }

  get servesAsBaseline(): boolean {
    return this.state.servesAsBaseline;
  }

  get healthSampleGroup(): HealthSampleGroup | null {
    return this.state.healthSampleGroup;
  }

  get sampledAt(): Date {
    return this.state.sampledAt;
  }

  get rubricVersion(): RubricVersion | null {
    return this.state.rubricVersion;
  }

  get currency(): string {
    return this.state.currency;
  }

  get runSubset(): readonly RunId[] | null {
    return this.state.runSubset;
  }

  get referenceReplayId(): ReplayId | null {
    return this.state.referenceReplayId;
  }

  get pairwiseReferenceId(): ReplayId | null {
    return this.state.pairwiseReferenceId;
  }

  get originals(): readonly RunId[] {
    return this.state.originals;
  }

  get entries(): readonly EntryOutcome[] {
    return this.state.entries;
  }

  get spend(): OutcomeSpend {
    return this.spendIn(this.state.entries);
  }

  spendAmong(runSubset: readonly RunId[]): OutcomeSpend {
    return this.spendIn(
      this.state.entries.filter((each) =>
        runSubset.some((run) => run.equals(each.original)),
      ),
    );
  }

  get spent(): Money {
    return this.spend.spent;
  }

  private spendIn(entries: readonly EntryOutcome[]): OutcomeSpend {
    const spent = spendOf(entries.map((each) => each.spent));

    return {
      spent: spentIn(spent, this.state.currency),
      spentElsewhere: spentElsewhereIn(spent, this.state.currency),
      unpricedCalls: spent.unpriced,
    };
  }
}
