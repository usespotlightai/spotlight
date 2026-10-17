import { resultOf, type Scoring } from '@replays/domain/services/entry-result';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import type { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import {
  EntryPairing,
  type PairVerdict,
} from '@replays/domain/value-objects/entry-pairing.vo';
import type { EntryReason } from '@replays/domain/value-objects/entry-reason';
import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ReplayEnding } from '@replays/domain/value-objects/replay-ending';
import type { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const MAX_QUEUE_ATTEMPTS = 10;

const isConclusive = (checks: ChangeChecks | null): boolean =>
  checks?.state === 'passed' || checks?.state === 'failed';

interface EntryState {
  readonly position: number;
  readonly original: RunId;
  readonly taskId: TaskId;
  readonly repeat: number;
  readonly run: RunId | null;
  readonly queued: boolean;
  readonly fingerprint: StationFingerprint | null;
  readonly queueAttempts: number;
  readonly unreplayableReason: UnreplayableReason | null;
  readonly notRun: boolean;
  readonly end: RunEnd | null;
  readonly measures: EntryMeasures | null;
  readonly checks: ChangeChecks | null;
  readonly judging: EntryJudging | null;
  readonly draftingSpent: ModelSpent | null;
  readonly judgingSpent: ModelSpent | null;
  readonly succeeded: boolean | null;
  readonly reasons: readonly EntryReason[];
  readonly secondJudging: EntryJudging | null;
  readonly rejudgingSpent: ModelSpent | null;
  readonly recheck: ChangeChecks | null;
  readonly pairing: EntryPairing | null;
  readonly pairingSpent: ModelSpent | null;
}

const sameSpend = (
  one: ModelSpent | null,
  other: ModelSpent | null,
): boolean =>
  one === null ? other === null : other !== null && one.equals(other);

const sameReasons = (
  one: readonly EntryReason[],
  other: readonly EntryReason[],
): boolean => JSON.stringify(one) === JSON.stringify(other);

export class ReplayEntry {
  private constructor(private readonly state: EntryState) {}

  static waiting(input: {
    position: number;
    original: RunId;
    taskId: TaskId;
    repeat: number;
  }): ReplayEntry {
    return new ReplayEntry({
      ...input,
      run: null,
      queued: false,
      fingerprint: null,
      queueAttempts: 0,
      unreplayableReason: null,
      notRun: false,
      end: null,
      measures: null,
      checks: null,
      judging: null,
      draftingSpent: null,
      judgingSpent: null,
      succeeded: null,
      reasons: [],
      secondJudging: null,
      rejudgingSpent: null,
      recheck: null,
      pairing: null,
      pairingSpent: null,
    });
  }

  static rehydrate(state: EntryState): ReplayEntry {
    if (state.run === null && (state.queued || state.end || state.measures)) {
      throw new InconsistentStateError(
        'replay entry',
        'ended or was queued without a run of its own',
      );
    }
    if (state.unreplayableReason !== null && state.end !== null) {
      throw new InconsistentStateError(
        'replay entry',
        'both ran and could not be replayed',
      );
    }
    if (state.secondJudging !== null && !state.judging?.verdict) {
      throw new InconsistentStateError(
        'replay entry',
        'was judged a second time without a first verdict',
      );
    }
    if (state.pairing !== null && state.run === null) {
      throw new InconsistentStateError(
        'replay entry',
        'was compared side by side without a run of its own',
      );
    }
    if (state.recheck !== null && !isConclusive(state.checks)) {
      throw new InconsistentStateError(
        'replay entry',
        'was checked again without its first check passing or failing',
      );
    }

    return new ReplayEntry(state);
  }

  get position(): number {
    return this.state.position;
  }

  get original(): RunId {
    return this.state.original;
  }

  get taskId(): TaskId {
    return this.state.taskId;
  }

  get repeat(): number {
    return this.state.repeat;
  }

  get run(): RunId | null {
    return this.state.run;
  }

  get queued(): boolean {
    return this.state.queued;
  }

  get fingerprint(): StationFingerprint | null {
    return this.state.fingerprint;
  }

  get queueAttempts(): number {
    return this.state.queueAttempts;
  }

  get unreplayableReason(): UnreplayableReason | null {
    return this.state.unreplayableReason;
  }

  get notRun(): boolean {
    return this.state.notRun;
  }

  get end(): RunEnd | null {
    return this.state.end;
  }

  get measures(): EntryMeasures | null {
    return this.state.measures;
  }

  get checks(): ChangeChecks | null {
    return this.state.checks;
  }

  get judging(): EntryJudging | null {
    return this.state.judging;
  }

  get draftingSpent(): ModelSpent | null {
    return this.state.draftingSpent;
  }

  get judgingSpent(): ModelSpent | null {
    return this.state.judgingSpent;
  }

  get modelSpends(): readonly ModelSpent[] {
    return [this.state.draftingSpent, this.state.judgingSpent].flatMap(
      (each) => (each ? [each] : []),
    );
  }

  get pairing(): EntryPairing | null {
    return this.state.pairing;
  }

  get pairingSpent(): ModelSpent | null {
    return this.state.pairingSpent;
  }

  get changed(): boolean {
    return (
      this.state.end?.ending === 'completed' &&
      (this.state.measures?.changedLines ?? 0) > 0
    );
  }

  pairableFor(scoring: Scoring): boolean {
    return (
      this.state.run !== null && this.changed && this.concludedFor(scoring)
    );
  }

  wantsPairing(scoring: Scoring): boolean {
    return this.state.pairing === null && this.pairableFor(scoring);
  }

  pairingAsked(against: RunId): ReplayEntry {
    return this.state.pairing === null
      ? this.with({ pairing: EntryPairing.asked(against) })
      : this;
  }

  pairingLeft(against: RunId, why: string): ReplayEntry {
    return this.state.pairing === null
      ? this.with({ pairing: EntryPairing.asked(against).failed(why) })
      : this;
  }

  paired(
    against: RunId,
    verdict: PairVerdict,
    spent: ModelSpent | null,
  ): ReplayEntry {
    const pairing = this.state.pairing;

    return pairing?.pending && pairing.isAgainst(against)
      ? this.with({ pairing: pairing.judged(verdict), pairingSpent: spent })
      : this;
  }

  pairingFailed(
    against: RunId,
    why: string,
    spent: ModelSpent | null,
  ): ReplayEntry {
    const pairing = this.state.pairing;

    return pairing?.pending && pairing.isAgainst(against)
      ? this.with({ pairing: pairing.failed(why), pairingSpent: spent })
      : this;
  }

  get secondJudging(): EntryJudging | null {
    return this.state.secondJudging;
  }

  get rejudgingSpent(): ModelSpent | null {
    return this.state.rejudgingSpent;
  }

  get recheck(): ChangeChecks | null {
    return this.state.recheck;
  }

  get judgeAgreed(): boolean | null {
    const first = this.state.judging?.verdict;
    const second = this.state.secondJudging?.verdict;

    return first && second ? first.passes === second.passes : null;
  }

  get checksFlipped(): boolean | null {
    const recheck = this.state.recheck;

    return isConclusive(this.state.checks) && isConclusive(recheck)
      ? this.state.checks?.state !== recheck?.state
      : null;
  }

  get wantsRejudging(): boolean {
    return this.state.secondJudging === null && !!this.state.judging?.verdict;
  }

  get wantsRecheck(): boolean {
    return this.state.recheck === null && isConclusive(this.state.checks);
  }

  rejudgingAsked(): ReplayEntry {
    return this.wantsRejudging
      ? this.with({ secondJudging: EntryJudging.asked() })
      : this;
  }

  recheckAsked(): ReplayEntry {
    return this.wantsRecheck
      ? this.with({ recheck: ChangeChecks.checking() })
      : this;
  }

  rejudged(verdict: JudgeVerdict, spent: ModelSpent | null): ReplayEntry {
    return this.state.secondJudging?.pending
      ? this.with({
          secondJudging: EntryJudging.judged(verdict),
          rejudgingSpent: spent,
        })
      : this;
  }

  rejudgingFailed(why: string, spent: ModelSpent | null): ReplayEntry {
    return this.state.secondJudging?.pending
      ? this.with({
          secondJudging: EntryJudging.failed(why),
          rejudgingSpent: spent,
        })
      : this;
  }

  rechecked(checks: ChangeChecks): ReplayEntry {
    return this.state.recheck?.pending && !checks.equals(this.state.recheck)
      ? this.with({ recheck: checks })
      : this;
  }

  get verdict(): JudgeVerdict | null {
    return this.state.judging?.verdict ?? null;
  }

  get succeeded(): boolean | null {
    return this.state.succeeded;
  }

  get reasons(): readonly EntryReason[] {
    return this.state.reasons;
  }

  concludedFor(scoring: Scoring): boolean {
    return resultOf(this.state, scoring).concluded;
  }

  wantsJudging(scoring: Scoring): boolean {
    return (
      scoring.judges &&
      this.state.judging === null &&
      this.state.unreplayableReason === null &&
      this.state.end?.ending === 'completed' &&
      (this.state.checks?.drafted ?? false)
    );
  }

  reviewed(checks: ChangeChecks, drafting: ModelSpent | null): ReplayEntry {
    if (
      this.state.run === null ||
      (this.state.checks?.equals(checks) &&
        sameSpend(this.state.draftingSpent, drafting))
    ) {
      return this;
    }

    return this.with({ checks, draftingSpent: drafting });
  }

  judgingAsked(): ReplayEntry {
    return this.state.judging
      ? this
      : this.with({ judging: EntryJudging.asked() });
  }

  judged(verdict: JudgeVerdict, spent: ModelSpent | null): ReplayEntry {
    return this.state.judging?.verdict || this.state.run === null
      ? this
      : this.with({
          judging: EntryJudging.judged(verdict),
          judgingSpent: spent,
        });
  }

  judgingFailed(why: string, spent: ModelSpent | null): ReplayEntry {
    return (this.state.judging && !this.state.judging.pending) ||
      this.state.run === null
      ? this
      : this.with({ judging: EntryJudging.failed(why), judgingSpent: spent });
  }

  scored(scoring: Scoring): ReplayEntry {
    const { succeeded, reasons } = resultOf(this.state, scoring);

    return succeeded === this.state.succeeded &&
      sameReasons(reasons, this.state.reasons)
      ? this
      : this.with({ succeeded, reasons });
  }

  get isWaiting(): boolean {
    return (
      this.state.run === null &&
      this.state.unreplayableReason === null &&
      !this.state.notRun
    );
  }

  get isSettled(): boolean {
    if (this.state.unreplayableReason !== null || this.state.notRun) {
      return true;
    }

    const end = this.state.end;

    return end !== null && (this.state.measures !== null || !end.isDigested);
  }

  get occupiesARunner(): boolean {
    return this.state.run !== null && !this.isSettled;
  }

  get ending(): ReplayEnding | null {
    if (this.state.unreplayableReason !== null) {
      return 'unreplayable';
    }
    if (this.state.notRun) {
      return 'not-run';
    }
    return this.isSettled ? (this.state.end?.ending ?? null) : null;
  }

  ranAs(run: RunId): boolean {
    return this.state.run?.equals(run) ?? false;
  }

  reserved(run: RunId): ReplayEntry {
    if (!this.isWaiting) {
      throw new InconsistentStateError(
        'replay entry',
        'was given a run while it already had one or a result',
      );
    }

    return this.with({ run });
  }

  confirmed(fingerprint: StationFingerprint | null): ReplayEntry {
    return this.state.queued ? this : this.with({ queued: true, fingerprint });
  }

  queueFailed(): ReplayEntry {
    if (this.state.queued || !this.occupiesARunner) {
      return this;
    }

    return this.with({ queueAttempts: this.state.queueAttempts + 1 });
  }

  get isGivenUp(): boolean {
    return (
      this.occupiesARunner &&
      !this.state.queued &&
      this.state.queueAttempts >= MAX_QUEUE_ATTEMPTS
    );
  }

  gaveUp(): ReplayEntry {
    return this.isGivenUp ? this.unreplayable('dispatch-failed') : this;
  }

  forgone(): ReplayEntry {
    return this.state.run !== null && !this.state.queued && !this.isSettled
      ? this.with({ notRun: true })
      : this;
  }

  unreplayable(reason: UnreplayableReason): ReplayEntry {
    return this.state.end || this.state.unreplayableReason !== null
      ? this
      : this.with({ unreplayableReason: reason, queued: false });
  }

  skipped(): ReplayEntry {
    return this.isWaiting ? this.with({ notRun: true }) : this;
  }

  ended(end: RunEnd): ReplayEntry {
    return this.state.end || this.state.unreplayableReason !== null
      ? this
      : this.with({ end, queued: true });
  }

  measured(measures: EntryMeasures): ReplayEntry {
    return this.state.measures ? this : this.with({ measures, queued: true });
  }

  private with(part: Partial<EntryState>): ReplayEntry {
    return new ReplayEntry({ ...this.state, ...part });
  }

  equals(other: ReplayEntry): boolean {
    return (
      this.state.position === other.state.position &&
      this.state.original.equals(other.state.original)
    );
  }
}
