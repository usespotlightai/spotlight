import type {
  ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
import { ReplayPairJudgingWanted } from '@replays/domain/events/replay-pair-judging-wanted.event';
import { ReplayPairingDue } from '@replays/domain/events/replay-pairing-due.event';
import { ReplayRecheckWanted } from '@replays/domain/events/replay-recheck-wanted.event';
import { ReplayRejudgingWanted } from '@replays/domain/events/replay-rejudging-wanted.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopAsked } from '@replays/domain/events/replay-stop-asked.event';
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
import { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import {
  isValidRepeatCount,
  MAX_REPEATS,
} from '@replays/domain/value-objects/replay-repeats';
import type { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import type {
  ReplayEnd,
  ReplayState,
} from '@replays/domain/value-objects/replay-state';
import type { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
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
  readonly scoringDigest: string;
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
  readonly scoringDigest: string;
  readonly ceiling: Spend;
  readonly unpricedRate: Spend | null;
  readonly among: readonly RunId[] | null;
  readonly answers: readonly OracleAnswered[] | null;
  readonly repeats: number;
  readonly probe: boolean;
  readonly comparedWith: ReplayId | null;
  readonly pairsWith: ReplayId | null;
  readonly searchId: SearchId | null;
  readonly state: ReplayState;
  readonly entries: readonly ReplayEntry[];
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly stoppedAt: Date | null;
  readonly version: number;
}

const DISPATCHING: readonly ReplayState[] = ['queued', 'running'];

const STOPPED_BEFORE_JUDGING = 'stopped-before-judging';

export const PAIRING_STATE = 'finished' satisfies ReplayState;

export const PAIR_ATTEMPTS = 2;

const JUDGED_BOTH_WAYS = 2;

const OTHER_RUBRIC = 'other-rubric';

const OUT_OF_BUDGET = 'budget';

const copiesOf = (
  entries: readonly ReplaySetEntry[],
  repeats: number,
): readonly ReplayEntry[] =>
  Array.from({ length: repeats }, (_, copy) => copy + 1).flatMap((repeat) =>
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
  readonly ceiling: Spend;
  readonly repeats: number;
  readonly probe: boolean;
}

export interface OracleTerms {
  readonly answers: readonly OracleAnswered[];
  readonly against: Replay;
  readonly live: ReplayedCandidate;
}

export class Replay extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isAbandoned = false,
  ) {
    super();
  }

  static start(input: {
    id: ReplayId;
    set: ReplaySet;
    candidate: ReplayedCandidate;
    baseline: boolean;
    ceiling: Spend;
    at: Date;
    by: Attribution;
    wanting?: WantedBaseline | null;
    among?: readonly RunId[];
    repeats?: number;
    probe?: boolean;
    oracle?: OracleTerms;
    pairsWith?: ReplayId | null;
    searchId?: SearchId;
    unpricedRate?: Spend;
  }): Replay {
    const { set } = input;
    const wanting = input.wanting ?? null;
    const oracle = input.oracle ?? null;
    const answers = oracle ? [...oracle.answers] : null;
    const among = answers?.map((each) => each.run) ?? input.among ?? null;
    const repeats = input.repeats ?? 1;
    const probe = input.probe ?? false;
    const comparedWith = oracle?.against.id ?? null;
    const pairsWith = wanting ? wanting.id : (input.pairsWith ?? null);

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
        !isValidRepeatCount(wanting.repeats) ||
        (wanting.probe && wanting.repeats < 2))
    ) {
      throw new InvalidReplayError(
        'cannot both be a baseline and want one, and wants one only of the live config on terms a baseline may have',
      );
    }
    if (among && (input.baseline || wanting)) {
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
        (input.among !== undefined ||
          input.baseline ||
          wanting ||
          probe ||
          input.pairsWith ||
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
        'handed the answer must replay some runs of the set against a finished whole-set replay of it, outside a search, never side by side',
      );
    }
    if (
      pairsWith &&
      (input.baseline ||
        probe ||
        pairsWith.equals(input.id) ||
        (wanting !== null &&
          input.pairsWith &&
          !input.pairsWith.equals(wanting.id)))
    ) {
      throw new InvalidReplayError(
        'cannot be compared side by side as a baseline or probe',
      );
    }
    if (
      probe &&
      (!input.candidate.isLive ||
        among ||
        repeats < 2 ||
        input.searchId !== undefined)
    ) {
      throw new InvalidReplayError(
        'probe must replay the live config, every run more than once, outside a search',
      );
    }
    if (
      among &&
      (among.length === 0 ||
        among.some(
          (run, place) =>
            !set.includes(run) ||
            among.findIndex((other) => other.equals(run)) !== place,
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
      scoringDigest: input.candidate.scoringDigest,
      ceiling: input.ceiling,
      unpricedRate: input.unpricedRate ?? null,
      among: among && [...among],
      answers,
      repeats,
      probe,
      comparedWith,
      pairsWith,
      searchId: input.searchId ?? null,
      state: 'queued',
      entries: copiesOf(
        set.entries.filter(
          (each) => !among || among.some((run) => run.equals(each.runId)),
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
            probe,
          }),
        ),
      ),
    );

    if (wanting) {
      started.record(
        new ReplayBaselineWanted(
          input.id,
          set.workspaceId,
          set.id,
          wanting.id,
          wanting.candidate.id,
          wanting.ceiling,
          input.unpricedRate ?? null,
          repeats,
          wanting.repeats,
          wanting.probe,
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
      ceiling: Spend;
      repeats: number;
    },
  ): boolean {
    const { set, id, candidate } = oracle;

    return (
      live.isLive &&
      against.candidateId.equals(live.id) &&
      live.basedOn.equals(candidate.basedOn) &&
      against.scoringDigest === candidate.scoringDigest &&
      against.repeats === oracle.repeats &&
      against.ceiling.equals(oracle.ceiling) &&
      against.setId.equals(set.id) &&
      !against.id.equals(id) &&
      against.among === null &&
      against.searchId === null &&
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

  get scoringDigest(): string {
    return this.state.scoringDigest;
  }

  get scoring(): Scoring {
    return { judges: this.state.judges, checks: this.state.checked };
  }

  get pairsWith(): ReplayId | null {
    return this.state.pairsWith;
  }

  get pairs(): boolean {
    return this.state.judges && this.state.pairsWith !== null;
  }

  get takesPairings(): boolean {
    return this.state.state === PAIRING_STATE;
  }

  private pairingEstimateOf(entry: ReplayEntry): Spend {
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

  private counterpartEntryOf(
    counterpart: Replay,
    entry: ReplayEntry,
  ): ReplayEntry | null {
    const copies = counterpart.entries.filter((each) =>
      each.original.equals(entry.original),
    );

    return (
      copies.find((each) => each.repeat === entry.repeat) ??
      copies.find((each) => each.repeat === 1) ??
      null
    );
  }

  pairAgainst(
    counterpart: Replay,
    accepted: (original: RunId) => boolean,
  ): Replay {
    if (
      !this.pairs ||
      !this.takesPairings ||
      !this.state.pairsWith?.equals(counterpart.id)
    ) {
      return this;
    }

    const otherRubric = counterpart.rubricVersion !== this.state.rubricVersion;
    const outstanding = this.state.entries.filter(
      (each) => each.pairing?.pending,
    );
    let reserved = outstanding.reduce(
      (total, each) => total.plus(this.pairingEstimateOf(each)),
      this.charged,
    );
    const wanted: { run: RunId; against: RunId; original: RunId }[] = [];
    const overBudget: ReplayEntry[] = [];
    const entries = this.state.entries.map((entry) => {
      const theirs = this.counterpartEntryOf(counterpart, entry);
      const run = entry.run;
      const against = theirs?.run;

      if (
        !run ||
        !against ||
        !theirs.pairableFor(counterpart.scoring) ||
        !entry.wantsPairing(this.scoring) ||
        !accepted(entry.original)
      ) {
        return entry;
      }
      if (otherRubric) {
        return entry.pairingLeft(against, OTHER_RUBRIC);
      }

      const expected = reserved.plus(this.pairingEstimateOf(entry));

      if (!expected.isWithin(this.state.ceiling)) {
        overBudget.push(entry);
        return entry;
      }

      reserved = expected;
      wanted.push({ run, against, original: entry.original });
      return entry.pairingAsked(against);
    });
    const resulting =
      outstanding.length === 0 && wanted.length === 0
        ? entries.map((entry) => {
            const against = this.counterpartEntryOf(counterpart, entry)?.run;

            return against && overBudget.includes(entry)
              ? entry.pairingLeft(against, OUT_OF_BUDGET)
              : entry;
          })
        : entries;

    if (resulting.every((each, place) => each === this.state.entries[place])) {
      return this;
    }

    const asked = this.with({ entries: resulting });

    for (const each of wanted) {
      asked.record(
        new ReplayPairJudgingWanted(
          this.id,
          this.workspaceId,
          this.state.candidateId,
          each.run,
          each.against,
          each.original,
        ),
      );
    }

    return asked;
  }

  pair(
    run: RunId,
    against: RunId,
    verdict: PairVerdict,
    spent: ModelSpent | null,
  ): Replay {
    return this.afterPairing(
      this.secondRound(run, (entry) => entry.paired(against, verdict, spent)),
    );
  }

  recordPairingFailure(
    run: RunId,
    against: RunId,
    why: string,
    spent: ModelSpent | null,
  ): Replay {
    return this.afterPairing(
      this.secondRound(run, (entry) =>
        entry.pairingFailed(against, why, spent),
      ),
    );
  }

  private afterPairing(changed: Replay): Replay {
    if (changed === this || !changed.awaitsPairing) {
      return changed;
    }

    changed.record(new ReplayPairingDue(this.id, this.workspaceId));

    return changed;
  }

  get ceiling(): Spend {
    return this.state.ceiling;
  }

  get current(): ReplayState {
    return this.state.state;
  }

  get among(): readonly RunId[] | null {
    return this.state.among;
  }

  get repeats(): number {
    return this.state.repeats;
  }

  get probe(): boolean {
    return this.state.probe;
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

  get comparedWith(): ReplayId | null {
    return this.state.comparedWith;
  }

  get counterpart(): ReplayId | null {
    return this.state.pairsWith ?? this.state.comparedWith;
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

  get spent(): Spend {
    return this.spentIn(this.everySpend);
  }

  get spentElsewhere(): readonly Spend[] {
    return this.spentElsewhereIn(this.everySpend);
  }

  get unpricedRate(): Spend | null {
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

  private chargeOf(spends: readonly ModelSpent[]): Spend {
    const rate = this.state.unpricedRate;
    const priced = spends.reduce(
      (sum, each) => sum.plus(this.spentIn(each)),
      Spend.none(this.state.ceiling.currency),
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

  get charged(): Spend {
    const rate = this.state.unpricedRate;
    const spent = this.spent.plus(this.chargeOf(this.secondRoundSpends));

    return rate ? spent.plus(rate.scaled(this.unpricedRuns, 1)) : spent;
  }

  get unpricedCalls(): number {
    return this.everySpend.unpriced;
  }

  spendAmong(among: readonly RunId[]): {
    readonly spent: Spend;
    readonly spentElsewhere: readonly Spend[];
    readonly unpricedCalls: number;
  } {
    const spent = this.spendOf(
      this.state.entries.filter((each) =>
        among.some((run) => run.equals(each.original)),
      ),
    );

    return {
      spent: this.spentIn(spent),
      spentElsewhere: this.spentElsewhereIn(spent),
      unpricedCalls: spent.unpriced,
    };
  }

  private spentIn(spent: ModelSpent): Spend {
    const ceiling = this.state.ceiling;

    return (
      spent.spends.find((each) => each.sameCurrencyAs(ceiling)) ??
      Spend.none(ceiling.currency)
    );
  }

  private spentElsewhereIn(spent: ModelSpent): readonly Spend[] {
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
    return DISPATCHING.includes(this.state.state);
  }

  get isUnderway(): boolean {
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

  gaveUp(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.gaveUp(), at);
  }

  forgo(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.forgone(), at);
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
    drafting: ModelSpent | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.reviewed(checks, drafting), at);
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

  stop(at: Date, by: Attribution): Replay {
    if (this.state.stoppedAt || !this.isUnderway) {
      throw new ReplayEndedError(this.id.value);
    }

    const letGo = this.runsInFlight;
    const stopped = this.with({
      state: this.isDispatching ? 'stopped' : this.state.state,
      entries: this.state.entries.map((each) =>
        each.skipped().scored(this.scoring),
      ),
      endedAt: this.state.endedAt ?? at,
      stoppedAt: at,
    });

    stopped.record(new ReplayStopped(this.id, this.workspaceId, letGo));
    if (this.isDispatching) {
      stopped.record(this.endedAs('stopped'));
    }
    stopped.record(
      new ReplayStopAsked(
        this.id,
        this.teamId,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return stopped;
  }

  abandon(): Replay {
    const letGo =
      this.isUnderway && !this.state.stoppedAt ? this.runsInFlight : [];
    const abandoned = new Replay(this.state, true);

    abandoned.inheritEvents(this);

    if (letGo.length > 0) {
      abandoned.record(new ReplayStopped(this.id, this.workspaceId, letGo));
    }
    if (this.isDispatching) {
      abandoned.record(this.endedAs('abandoned'));
    }

    return abandoned;
  }

  private endedAs(state: ReplayEnd): ReplayEnded {
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
        new ReplayJudgingWanted(
          this.id,
          this.workspaceId,
          this.state.candidateId,
          run,
          entry.original,
        ),
      );
    }

    return changed.finishedAt(at).overBudgetAt(at);
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
      entry = changed.judgingAsked().scored(scoring);
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

  private overBudgetAt(at: Date): Replay {
    if (!this.isDispatching || !this.charged.reaches(this.state.ceiling)) {
      return this;
    }

    const letGo = this.runsInFlight;
    const over = this.with({
      state: 'over-budget',
      entries: this.state.entries.map((each) =>
        each.skipped().scored(this.scoring),
      ),
      endedAt: at,
    });

    over.record(new ReplayOverBudget(this.id, this.workspaceId, letGo));
    over.record(this.endedAs('over-budget'));

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

    return this.state.probe ? finished.probedAgain() : finished;
  }

  private probedAgain(): Replay {
    let reserved = this.charged;
    const entries = this.state.entries.map((entry) => {
      const rechecked = entry.recheckAsked();

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
      return rechecked.rejudgingAsked();
    });
    const asked = this.with({ entries });

    for (const [place, entry] of this.state.entries.entries()) {
      const now = entries[place];
      const run = entry.run;

      if (!run || !now) {
        continue;
      }
      if (!entry.secondJudging && now.secondJudging) {
        asked.record(new ReplayRejudgingWanted(this.id, this.workspaceId, run));
      }
      if (!entry.recheck && now.recheck) {
        asked.record(new ReplayRecheckWanted(this.id, this.workspaceId, run));
      }
    }

    return asked;
  }

  private with(part: Partial<State>): Replay {
    const next = new Replay({ ...this.state, ...part }, this.isAbandoned);

    next.inheritEvents(this);

    return next;
  }
}
