import type {
  ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import { ReplayCeilingReached } from '@replays/domain/events/replay-ceiling-reached.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopRequested } from '@replays/domain/events/replay-stop-requested.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import { ReplayEndedError } from '@replays/domain/exceptions/replay-ended.error';
import type { Scoring } from '@replays/domain/services/entry-result';
import type {
  OracleAnswer,
  OracleAnswered,
} from '@replays/domain/services/oracle-answer';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import type { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import type { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import {
  isValidRepeatCount,
  MAX_REPEATS,
} from '@replays/domain/value-objects/replay-repeats';
import type { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import {
  DISPATCHING_REPLAY_STATES,
  type ReplayState,
  type ReplayStopReason,
} from '@replays/domain/value-objects/replay-state';
import type { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReplayedCandidate {
  readonly id: CandidateId;
  readonly isLive: boolean;
  readonly isOracle: boolean;
  readonly judges: boolean;
  readonly checksChanges: boolean;
  readonly rubricVersion: string | null;
  readonly scoringHash: string;
  readonly basedOn: StationFingerprint;
  isFor(stationId: string): boolean;
}

interface State {
  readonly id: ReplayId;
  readonly station: ReplayedStation;
  readonly setId: ReplaySetId;
  readonly candidateId: CandidateId;
  readonly baseline: boolean;
  readonly judges: boolean;
  readonly checked: boolean;
  readonly rubricVersion: string | null;
  readonly scoringHash: string;
  readonly ceiling: Money;
  readonly unpricedRate: Money | null;
  readonly runSubset: readonly RunId[] | null;
  readonly answers: readonly OracleAnswered[] | null;
  readonly repeats: number;
  readonly calibration: boolean;
  readonly referenceReplayId: ReplayId | null;
  readonly pairwiseReferenceId: ReplayId | null;
  readonly searchId: SearchId | null;
  readonly state: ReplayState;
  readonly entries: readonly ReplayEntry[];
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly stoppedAt: Date | null;
  readonly version: number;
}

const STOPPED_BEFORE_JUDGING = 'stopped-before-judging';

export const PAIRING_STATE = 'finished' satisfies ReplayState;

export const PAIR_ATTEMPTS = 2;

const JUDGED_BOTH_WAYS = 2;

const OTHER_RUBRIC = 'other-rubric';

const CEILING_REACHED = 'ceiling-reached';

const repeatsOf = (
  entries: readonly ReplaySetEntry[],
  repeats: number,
): readonly ReplayEntry[] =>
  Array.from({ length: repeats }, (_, index) => index + 1).flatMap((repeat) =>
    entries.map((each, at) =>
      ReplayEntry.waiting({
        position: (repeat - 1) * entries.length + at,
        original: each.runId,
        taskId: each.taskId,
        repeat,
      }),
    ),
  );

export interface WantedBaseline {
  readonly id: ReplayId;
  readonly candidate: ReplayedCandidate;
  readonly ceiling: Money;
  readonly repeats: number;
}

export interface OracleTerms {
  readonly answers: readonly OracleAnswered[];
  readonly against: Replay;
  readonly live: ReplayedCandidate;
}

export class Replay extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static start(input: {
    id: ReplayId;
    set: ReplaySet;
    candidate: ReplayedCandidate;
    baseline: boolean;
    ceiling: Money;
    at: Date;
    by: ChangeActor;
    wanting?: WantedBaseline | null;
    runSubset?: readonly RunId[];
    repeats?: number;
    calibration?: boolean;
    oracle?: OracleTerms;
    pairwiseReferenceId?: ReplayId | null;
    searchId?: SearchId;
    unpricedRate?: Money;
  }): Replay {
    const { set } = input;
    const wanting = input.wanting ?? null;
    const oracle = input.oracle ?? null;
    const answers = oracle ? [...oracle.answers] : null;
    const runSubset =
      answers?.map((each) => each.run) ?? input.runSubset ?? null;
    const repeats = input.repeats ?? 1;
    const calibration = input.calibration ?? false;
    const referenceReplayId = oracle?.against.id ?? null;
    const pairwiseReferenceId = wanting
      ? wanting.id
      : (input.pairwiseReferenceId ?? null);

    set.stillAtItsStation();

    if (set.entries.length === 0) {
      throw new InvalidReplayError('must replay at least one run');
    }
    if (!input.candidate.isFor(set.station.stationId)) {
      throw new InvalidReplayError(
        'candidate must be for the replay set’s station',
      );
    }
    if (input.baseline && !input.candidate.isLive) {
      throw new InvalidReplayError('can be a baseline only of the live config');
    }
    if (
      wanting &&
      (input.baseline ||
        !wanting.candidate.isLive ||
        !wanting.candidate.isFor(set.station.stationId) ||
        !isValidRepeatCount(wanting.repeats))
    ) {
      throw new InvalidReplayError(
        'cannot both be a baseline and want one, and wants one only of the live config on terms a baseline may have',
      );
    }
    if (runSubset && (input.baseline || wanting)) {
      throw new InvalidReplayError(
        'must replay the whole set when it is or wants a baseline',
      );
    }
    if (!isValidRepeatCount(repeats)) {
      throw new InvalidReplayError(`repeats must be from 1 to ${MAX_REPEATS}`);
    }
    if (
      input.candidate.isOracle !== (oracle !== null) ||
      (oracle &&
        (input.runSubset !== undefined ||
          input.baseline ||
          wanting ||
          calibration ||
          input.pairwiseReferenceId ||
          input.searchId !== undefined ||
          !Replay.comparesOracles(oracle, {
            set,
            id: input.id,
            candidate: input.candidate,
            ceiling: input.ceiling,
            repeats,
          })))
    ) {
      throw new InvalidReplayError(
        'handed the answer must replay some runs of the set against a finished whole-set replay of it, outside a search or after a calibrating search seed, never side by side',
      );
    }
    if (
      pairwiseReferenceId &&
      (input.baseline ||
        calibration ||
        pairwiseReferenceId.equals(input.id) ||
        (wanting !== null &&
          input.pairwiseReferenceId &&
          !input.pairwiseReferenceId.equals(wanting.id)))
    ) {
      throw new InvalidReplayError(
        'cannot be compared side by side as a baseline or calibration',
      );
    }
    if (calibration && (!input.candidate.isLive || runSubset || repeats < 2)) {
      throw new InvalidReplayError(
        'calibration must replay the live config, every run more than once',
      );
    }
    if (
      runSubset &&
      (runSubset.length === 0 ||
        runSubset.some(
          (run, place) =>
            !set.includes(run) ||
            runSubset.findIndex((other) => other.equals(run)) !== place,
        ))
    ) {
      throw new InvalidReplayError(
        'of part of a set must replay each chosen run once',
      );
    }

    const started = new Replay({
      id: input.id,
      station: set.station,
      setId: set.id,
      candidateId: input.candidate.id,
      baseline: input.baseline,
      judges: input.candidate.judges,
      checked: input.candidate.checksChanges,
      rubricVersion: input.candidate.rubricVersion,
      scoringHash: input.candidate.scoringHash,
      ceiling: input.ceiling,
      unpricedRate: input.unpricedRate ?? null,
      runSubset: runSubset && [...runSubset],
      answers,
      repeats,
      calibration,
      referenceReplayId,
      pairwiseReferenceId,
      searchId: input.searchId ?? null,
      state: 'queued',
      entries: repeatsOf(
        set.entries.filter(
          (each) =>
            !runSubset || runSubset.some((run) => run.equals(each.runId)),
        ),
        repeats,
      ),
      startedAt: input.at,
      endedAt: null,
      stoppedAt: null,
      version: 0,
    });

    started.record(
      new ReplayStarted(
        input.id,
        set.teamId,
        ConfigurationChange.created(
          started.whatChanged,
          input.by,
          ReplayStartDetail.of({
            setId: set.id,
            candidateId: input.candidate.id,
            baseline: input.baseline,
            ceiling: input.ceiling,
            repeats,
            calibration,
          }),
        ),
      ),
    );

    if (wanting) {
      started.record(
        new ReplayBaselineRequested(
          input.id,
          set.workspaceId,
          set.id,
          wanting.id,
          wanting.candidate.id,
          wanting.ceiling,
          input.unpricedRate ?? null,
          repeats,
          wanting.repeats,
        ),
      );
    }

    return started;
  }

  private static comparesOracles(
    { against, live }: OracleTerms,
    oracle: {
      set: ReplaySet;
      id: ReplayId;
      candidate: ReplayedCandidate;
      ceiling: Money;
      repeats: number;
    },
  ): boolean {
    const { set, id, candidate } = oracle;

    return (
      live.isLive &&
      against.candidateId.equals(live.id) &&
      live.basedOn.equals(candidate.basedOn) &&
      against.scoringHash === candidate.scoringHash &&
      against.repeats === oracle.repeats &&
      against.ceiling.equals(oracle.ceiling) &&
      against.setId.equals(set.id) &&
      !against.id.equals(id) &&
      against.runSubset === null &&
      (against.searchId === null || against.calibration) &&
      against.current === 'finished'
    );
  }

  static rehydrate(state: State): Replay {
    return new Replay(state);
  }

  get id(): ReplayId {
    return this.state.id;
  }

  get station(): ReplayedStation {
    return this.state.station;
  }

  get workspaceId(): WorkspaceId {
    return this.state.station.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.station.teamId;
  }

  get setId(): ReplaySetId {
    return this.state.setId;
  }

  get candidateId(): CandidateId {
    return this.state.candidateId;
  }

  get baseline(): boolean {
    return this.state.baseline;
  }

  get judges(): boolean {
    return this.state.judges;
  }

  get checked(): boolean {
    return this.state.checked;
  }

  get rubricVersion(): string | null {
    return this.state.rubricVersion;
  }

  get scoringHash(): string {
    return this.state.scoringHash;
  }

  get scoring(): Scoring {
    return { judges: this.state.judges, checks: this.state.checked };
  }

  get pairwiseReferenceId(): ReplayId | null {
    return this.state.pairwiseReferenceId;
  }

  get pairs(): boolean {
    return this.state.judges && this.state.pairwiseReferenceId !== null;
  }

  get takesPairings(): boolean {
    return this.state.state === PAIRING_STATE;
  }

  private pairingEstimateOf(entry: ReplayEntry): Money {
    return this.chargeOf(entry.judgingSpent ? [entry.judgingSpent] : []).scaled(
      JUDGED_BOTH_WAYS * PAIR_ATTEMPTS,
      1,
    );
  }

  private get awaitsPairing(): boolean {
    return this.state.entries.some(
      (each) => each.pairing === null && each.pairableFor(this.scoring),
    );
  }

  private referenceEntryOf(
    reference: Replay,
    entry: ReplayEntry,
  ): ReplayEntry | null {
    const repeats = reference.entries.filter((each) =>
      each.original.equals(entry.original),
    );

    return (
      repeats.find((each) => each.repeat === entry.repeat) ??
      repeats.find((each) => each.repeat === 1) ??
      null
    );
  }

  pairAgainst(
    reference: Replay,
    accepted: (original: RunId) => boolean,
  ): Replay {
    if (
      !this.pairs ||
      !this.takesPairings ||
      !this.state.pairwiseReferenceId?.equals(reference.id)
    ) {
      return this;
    }

    const otherRubric = reference.rubricVersion !== this.state.rubricVersion;
    const outstanding = this.state.entries.filter(
      (each) => each.pairing?.pending,
    );
    let reserved = outstanding.reduce(
      (total, each) => total.plus(this.pairingEstimateOf(each)),
      this.charged,
    );
    const wanted: { run: RunId; other: RunId; original: RunId }[] = [];
    const ceilingReached: ReplayEntry[] = [];
    const entries = this.state.entries.map((entry) => {
      const theirs = this.referenceEntryOf(reference, entry);
      const run = entry.run;
      const other = theirs?.run;

      if (
        !run ||
        !other ||
        !theirs.pairableFor(reference.scoring) ||
        !entry.wantsPairing(this.scoring) ||
        !accepted(entry.original)
      ) {
        return entry;
      }
      if (otherRubric) {
        return entry.pairingLeft(other, OTHER_RUBRIC);
      }

      const expected = reserved.plus(this.pairingEstimateOf(entry));

      if (!expected.isWithin(this.state.ceiling)) {
        ceilingReached.push(entry);
        return entry;
      }

      reserved = expected;
      wanted.push({ run, other, original: entry.original });
      return entry.pairingRequested(other);
    });
    const resulting =
      outstanding.length === 0 && wanted.length === 0
        ? entries.map((entry) => {
            const other = this.referenceEntryOf(reference, entry)?.run;

            return other && ceilingReached.includes(entry)
              ? entry.pairingLeft(other, CEILING_REACHED)
              : entry;
          })
        : entries;

    if (resulting.every((each, place) => each === this.state.entries[place])) {
      return this;
    }

    const requested = this.with({ entries: resulting });

    for (const each of wanted) {
      requested.record(
        new ReplaySideBySideJudgingRequested(
          this.id,
          this.workspaceId,
          this.state.candidateId,
          each.run,
          each.other,
          each.original,
        ),
      );
    }

    return requested;
  }

  pair(
    run: RunId,
    other: RunId,
    verdict: PairVerdict,
    spent: ModelSpent | null,
  ): Replay {
    return this.afterPairing(
      this.secondRound(run, (entry) => entry.paired(other, verdict, spent)),
    );
  }

  recordPairingFailure(
    run: RunId,
    other: RunId,
    why: string,
    spent: ModelSpent | null,
  ): Replay {
    return this.afterPairing(
      this.secondRound(run, (entry) => entry.pairingFailed(other, why, spent)),
    );
  }

  private afterPairing(changed: Replay): Replay {
    if (changed === this || !changed.awaitsPairing) {
      return changed;
    }

    changed.record(new ReplayPairingRequested(this.id, this.workspaceId));

    return changed;
  }

  get ceiling(): Money {
    return this.state.ceiling;
  }

  get current(): ReplayState {
    return this.state.state;
  }

  get runSubset(): readonly RunId[] | null {
    return this.state.runSubset;
  }

  get repeats(): number {
    return this.state.repeats;
  }

  get calibration(): boolean {
    return this.state.calibration;
  }

  get isOracle(): boolean {
    return this.state.answers !== null;
  }

  answerTo(original: RunId): OracleAnswer | null {
    return (
      this.state.answers?.find((each) => each.run.equals(original))?.answer ??
      null
    );
  }

  get answers(): readonly OracleAnswered[] | null {
    return this.state.answers;
  }

  get referenceReplayId(): ReplayId | null {
    return this.state.referenceReplayId;
  }

  get reference(): ReplayId | null {
    return this.state.pairwiseReferenceId ?? this.state.referenceReplayId;
  }

  get searchId(): SearchId | null {
    return this.state.searchId;
  }

  get entries(): readonly ReplayEntry[] {
    return this.state.entries;
  }

  get startedAt(): Date {
    return this.state.startedAt;
  }

  get endedAt(): Date | null {
    return this.state.endedAt;
  }

  get stoppedAt(): Date | null {
    return this.state.stoppedAt;
  }

  get version(): number {
    return this.state.version;
  }

  get originals(): readonly RunId[] {
    return this.state.entries
      .filter((each) => each.repeat === 1)
      .map((each) => each.original);
  }

  get spent(): Money {
    return this.spentIn(this.everySpend);
  }

  get spentElsewhere(): readonly Money[] {
    return this.spentElsewhereIn(this.everySpend);
  }

  get unpricedRate(): Money | null {
    return this.state.unpricedRate;
  }

  private unpricedIn(spends: readonly ModelSpent[]): number {
    const ceiling = this.state.ceiling;

    return spends.reduce(
      (calls, each) =>
        calls +
        each.unpriced +
        each.spends.filter((spend) => !spend.sameCurrencyAs(ceiling)).length,
      0,
    );
  }

  private chargeOf(spends: readonly ModelSpent[]): Money {
    const rate = this.state.unpricedRate;
    const priced = spends.reduce(
      (sum, each) => sum.plus(this.spentIn(each)),
      Money.none(this.state.ceiling.currency),
    );

    return rate ? priced.plus(rate.scaled(this.unpricedIn(spends), 1)) : priced;
  }

  private get secondRoundSpends(): readonly ModelSpent[] {
    return this.state.entries.flatMap((each) =>
      [each.rejudgingSpent, each.pairingSpent].flatMap((spent) =>
        spent ? [spent] : [],
      ),
    );
  }

  get unpricedRuns(): number {
    const ceiling = this.state.ceiling;

    return this.state.entries.reduce((count, entry) => {
      const measures = entry.measures;
      const called =
        measures !== null &&
        (measures.cost !== null ||
          Object.values(measures.tokens).some((each) => each !== null));
      const unpricedRun =
        called && !measures?.cost?.sameCurrencyAs(ceiling) ? 1 : 0;

      return count + unpricedRun + this.unpricedIn(entry.modelSpends);
    }, 0);
  }

  get charged(): Money {
    const rate = this.state.unpricedRate;
    const spent = this.spent.plus(this.chargeOf(this.secondRoundSpends));

    return rate ? spent.plus(rate.scaled(this.unpricedRuns, 1)) : spent;
  }

  get unpricedCalls(): number {
    return this.everySpend.unpriced;
  }

  spendAmong(runSubset: readonly RunId[]): {
    readonly spent: Money;
    readonly spentElsewhere: readonly Money[];
    readonly unpricedCalls: number;
  } {
    const spent = this.spendOf(
      this.state.entries.filter((each) =>
        runSubset.some((run) => run.equals(each.original)),
      ),
    );

    return {
      spent: this.spentIn(spent),
      spentElsewhere: this.spentElsewhereIn(spent),
      unpricedCalls: spent.unpriced,
    };
  }

  private spentIn(spent: ModelSpent): Money {
    const ceiling = this.state.ceiling;

    return (
      spent.spends.find((each) => each.sameCurrencyAs(ceiling)) ??
      Money.none(ceiling.currency)
    );
  }

  private spentElsewhereIn(spent: ModelSpent): readonly Money[] {
    return spent.spends
      .filter((each) => !each.sameCurrencyAs(this.state.ceiling))
      .sort((one, other) => (one.currency < other.currency ? -1 : 1));
  }

  private get everySpend(): ModelSpent {
    return this.spendOf(this.state.entries);
  }

  private spendOf(entries: readonly ReplayEntry[]): ModelSpent {
    return entries.reduce(
      (spent, each) =>
        each.modelSpends.reduce(
          (total, model) => total.plus(model),
          spent.plus(
            ModelSpent.of(each.measures?.cost ? [each.measures.cost] : [], 0),
          ),
        ),
      ModelSpent.of([], 0),
    );
  }

  get occupying(): readonly ReplayEntry[] {
    return this.state.entries.filter((each) => each.occupiesARunner);
  }

  get runsInFlight(): readonly RunId[] {
    return this.occupying.flatMap((each) => (each.run ? [each.run] : []));
  }

  get unconfirmed(): readonly ReplayEntry[] {
    return this.state.entries.filter(
      (each) => each.occupiesARunner && !each.queued,
    );
  }

  get isDispatching(): boolean {
    return DISPATCHING_REPLAY_STATES.includes(this.state.state);
  }

  get isInProgress(): boolean {
    return this.isDispatching || this.occupying.length > 0;
  }

  get hasWaiting(): boolean {
    return (
      this.isDispatching && this.state.entries.some((each) => each.isWaiting)
    );
  }

  ran(run: RunId): boolean {
    return this.state.entries.some((each) => each.ranAs(run));
  }

  reserving(room: number, runIds: () => RunId): Replay {
    if (!this.isDispatching || room <= 0) {
      return this;
    }

    let left = room;
    const entries = this.state.entries.map((each) => {
      if (left === 0 || !each.isWaiting) {
        return each;
      }

      left -= 1;
      return each.reserved(runIds());
    });

    return left === room ? this : this.with({ entries, state: 'running' });
  }

  confirm(
    run: RunId,
    fingerprint: StationFingerprint | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.confirmed(fingerprint), at);
  }

  recordQueueFailure(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.queueFailed(), at);
  }

  exhaust(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.exhaust(), at);
  }

  cancel(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.cancelled(), at);
  }

  unreplayable(run: RunId, reason: UnreplayableReason, at: Date): Replay {
    return this.changing(run, (entry) => entry.unreplayable(reason), at);
  }

  recordRunEnd(run: RunId, runEnd: RunEnd): Replay {
    return this.changing(run, (entry) => entry.ended(runEnd), runEnd.at);
  }

  measure(run: RunId, measures: EntryMeasures, at: Date): Replay {
    return this.changing(run, (entry) => entry.measured(measures), at);
  }

  recordReview(
    run: RunId,
    checks: ChangeChecks,
    generation: ModelSpent | null,
    at: Date,
  ): Replay {
    return this.changing(
      run,
      (entry) => entry.reviewed(checks, generation),
      at,
    );
  }

  recordVerdict(
    run: RunId,
    verdict: JudgeVerdict,
    spent: ModelSpent | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.judged(verdict, spent), at);
  }

  recordJudgingFailure(
    run: RunId,
    why: string,
    spent: ModelSpent | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.judgingFailed(why, spent), at);
  }

  recordRejudgment(
    run: RunId,
    verdict: JudgeVerdict,
    spent: ModelSpent | null,
  ): Replay {
    return this.secondRound(run, (entry) => entry.rejudged(verdict, spent));
  }

  recordRejudgingFailure(
    run: RunId,
    why: string,
    spent: ModelSpent | null,
  ): Replay {
    return this.secondRound(run, (entry) => entry.rejudgingFailed(why, spent));
  }

  recheck(run: RunId, checks: ChangeChecks): Replay {
    return this.secondRound(run, (entry) => entry.rechecked(checks));
  }

  private secondRound(
    run: RunId,
    change: (entry: ReplayEntry) => ReplayEntry,
  ): Replay {
    const entries = this.state.entries.map((each) =>
      each.ranAs(run) ? change(each) : each,
    );

    return entries.every((each, place) => each === this.state.entries[place])
      ? this
      : this.with({ entries });
  }

  stop(at: Date, by: ChangeActor): Replay {
    if (this.state.stoppedAt || !this.isInProgress) {
      throw new ReplayEndedError(this.id.value);
    }

    const toCancel = this.runsInFlight;
    const stopped = this.with({
      state: this.isDispatching ? 'stopped' : this.state.state,
      entries: this.state.entries.map((each) =>
        each.skipped().scored(this.scoring),
      ),
      endedAt: this.state.endedAt ?? at,
      stoppedAt: at,
    });

    stopped.record(new ReplayStopped(this.id, this.workspaceId, toCancel));
    if (this.isDispatching) {
      stopped.record(this.endedAs('stopped'));
    }
    stopped.record(
      new ReplayStopRequested(
        this.id,
        this.teamId,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return stopped;
  }

  delete(): Replay {
    const toCancel =
      this.isInProgress && !this.state.stoppedAt ? this.runsInFlight : [];
    const deleted = new Replay(this.state, true);

    deleted.inheritEvents(this);

    if (toCancel.length > 0) {
      deleted.record(new ReplayStopped(this.id, this.workspaceId, toCancel));
    }
    if (this.isDispatching) {
      deleted.record(this.endedAs('deleted'));
    }

    return deleted;
  }

  private endedAs(state: ReplayStopReason): ReplayEnded {
    return new ReplayEnded(
      this.id,
      this.workspaceId,
      this.state.searchId,
      state,
    );
  }

  private get whatChanged() {
    return {
      resource: 'replay' as const,
      id: this.id.value,
      key: this.id.value,
    };
  }

  private changing(
    run: RunId,
    change: (entry: ReplayEntry) => ReplayEntry,
    at: Date,
  ): Replay {
    if (!this.ran(run)) {
      return this;
    }

    const wanted: ReplayEntry[] = [];
    let concluded = false;
    const entries = this.state.entries.map((each) => {
      if (!each.ranAs(run)) {
        return each;
      }

      const result = this.entryChange(each, change(each));

      if (result.newly) {
        concluded = true;
      }
      if (result.wanted) {
        wanted.push(result.entry);
      }

      return result.entry;
    });

    if (entries.every((each, place) => each === this.state.entries[place])) {
      return this;
    }

    const changed = this.with({ entries });

    if (concluded) {
      changed.record(
        new ReplayEntryConcluded(
          this.id,
          this.workspaceId,
          this.state.setId,
          run,
        ),
      );
    }

    for (const entry of wanted) {
      changed.record(
        new ReplayJudgingRequested(
          this.id,
          this.workspaceId,
          this.state.candidateId,
          run,
          entry.original,
        ),
      );
    }

    return changed.finishedAt(at).ceilingReachedAt(at);
  }

  private entryChange(
    was: ReplayEntry,
    changed: ReplayEntry,
  ): { entry: ReplayEntry; wanted: boolean; newly: boolean } {
    const scoring = this.scoring;
    let entry: ReplayEntry;
    let wanted = false;

    if (!changed.wantsJudging(scoring)) {
      entry = changed.scored(scoring);
    } else if (!this.isDispatching) {
      entry = changed
        .judgingFailed(STOPPED_BEFORE_JUDGING, null)
        .scored(scoring);
    } else {
      wanted = true;
      entry = changed.judgingRequested().scored(scoring);
    }

    return {
      entry,
      wanted,
      newly:
        !(was.hasEnded && was.concludedFor(scoring)) &&
        entry.hasEnded &&
        entry.concludedFor(scoring),
    };
  }

  private ceilingReachedAt(at: Date): Replay {
    if (!this.isDispatching || !this.charged.meets(this.state.ceiling)) {
      return this;
    }

    const toCancel = this.runsInFlight;
    const over = this.with({
      state: 'ceiling-reached',
      entries: this.state.entries.map((each) =>
        each.skipped().scored(this.scoring),
      ),
      endedAt: at,
    });

    over.record(new ReplayCeilingReached(this.id, this.workspaceId, toCancel));
    over.record(this.endedAs('ceiling-reached'));

    return over;
  }

  private finishedAt(at: Date): Replay {
    if (
      !this.isDispatching ||
      !this.state.entries.every(
        (each) => each.hasEnded && each.concludedFor(this.scoring),
      )
    ) {
      return this;
    }

    const finished = this.with({ state: 'finished', endedAt: at });

    finished.record(this.endedAs('finished'));

    return this.state.calibration ? finished.recalibrated() : finished;
  }

  private recalibrated(): Replay {
    let reserved = this.charged;
    const entries = this.state.entries.map((entry) => {
      const rechecked = entry.recheckRequested();

      if (!entry.wantsRejudging) {
        return rechecked;
      }

      const expected = reserved.plus(
        this.chargeOf(entry.judgingSpent ? [entry.judgingSpent] : []),
      );

      if (!expected.isWithin(this.state.ceiling)) {
        return rechecked;
      }

      reserved = expected;
      return rechecked.rejudgingRequested();
    });
    const requested = this.with({ entries });

    for (const [place, entry] of this.state.entries.entries()) {
      const now = entries[place];
      const run = entry.run;

      if (!run || !now) {
        continue;
      }
      if (!entry.secondJudging && now.secondJudging) {
        requested.record(
          new ReplayRejudgingRequested(this.id, this.workspaceId, run),
        );
      }
      if (!entry.recheck && now.recheck) {
        requested.record(
          new ReplayRecheckRequested(this.id, this.workspaceId, run),
        );
      }
    }

    return requested;
  }

  private with(part: Partial<State>): Replay {
    const next = new Replay({ ...this.state, ...part }, this.isDeleted);

    next.inheritEvents(this);

    return next;
  }
}
