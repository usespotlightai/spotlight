import type {
  ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
import { ReplayRecheckWanted } from '@replays/domain/events/replay-recheck-wanted.event';
import { ReplayRejudgingWanted } from '@replays/domain/events/replay-rejudging-wanted.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopAsked } from '@replays/domain/events/replay-stop-asked.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import { ReplayEndedError } from '@replays/domain/exceptions/replay-ended.error';
import type { Scoring } from '@replays/domain/services/entry-result';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import type { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayRefusal } from '@replays/domain/value-objects/replay-refusal';
import {
  holdsRepeats,
  MOST_REPEATS,
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
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReplayedCandidate {
  readonly id: CandidateId;
  readonly isLive: boolean;
  readonly isSanity: boolean;
  readonly judges: boolean;
  readonly checksChanges: boolean;
  readonly rubricVersion: string | null;
  readonly scoringDigest: string;
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
  readonly repeats: number;
  readonly probe: boolean;
  readonly comparedWith: ReplayId | null;
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
}

export class Replay extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isAbandoned = false,
  ) {
    super();
  }

  static started(input: {
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
    comparedWith?: ReplayId;
    searchId?: SearchId;
    unpricedRate?: Spend;
  }): Replay {
    const { set } = input;
    const wanting = input.wanting ?? null;
    const among = input.among ?? null;
    const repeats = input.repeats ?? 1;
    const probe = input.probe ?? false;
    const comparedWith = input.comparedWith ?? null;

    set.stillAtItsStation();

    if (set.entries.length === 0) {
      throw new InvalidReplayError('replays at least one run');
    }
    if (!input.candidate.isFor(set.station.stationId)) {
      throw new InvalidReplayError(
        'replays a candidate for the station its set is at',
      );
    }
    if (input.baseline && !input.candidate.isLive) {
      throw new InvalidReplayError(
        'is a baseline only when it replays the station’s live config',
      );
    }
    if (
      wanting &&
      (input.baseline ||
        !wanting.candidate.isLive ||
        !wanting.candidate.isFor(set.station.stationId))
    ) {
      throw new InvalidReplayError(
        'wants a baseline of the station’s live config only when it is no baseline itself',
      );
    }
    if (among && (input.baseline || wanting)) {
      throw new InvalidReplayError(
        'replays its whole set when it is or wants a baseline',
      );
    }
    if (!holdsRepeats(repeats)) {
      throw new InvalidReplayError(
        `replays each run from 1 to ${MOST_REPEATS} times`,
      );
    }
    if (
      input.candidate.isSanity !== (comparedWith !== null) ||
      comparedWith?.equals(input.id)
    ) {
      throw new InvalidReplayError(
        'replays a stronger model only beside another replay of the live config it is compared with, and only then',
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
        'probes its set only as the live config, replaying every run more than once, outside any search',
      );
    }
    if (
      among &&
      (among.length === 0 ||
        among.some(
          (run, place) =>
            !set.holds(run) ||
            among.findIndex((other) => other.equals(run)) !== place,
        ))
    ) {
      throw new InvalidReplayError(
        'replays some of its set’s runs, each once, when it replays only some',
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
      repeats,
      probe,
      comparedWith,
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
          input.ceiling,
          input.unpricedRate ?? null,
          repeats,
        ),
      );
    }

    return started;
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

  get comparedWith(): ReplayId | null {
    return this.state.comparedWith;
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

  private get rejudgingSpends(): readonly ModelSpent[] {
    return this.state.entries.flatMap((each) =>
      each.rejudgingSpent ? [each.rejudgingSpent] : [],
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
    const spent = this.spent.plus(this.chargeOf(this.rejudgingSpends));

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
          (held, model) => held.plus(model),
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

  confirmed(
    run: RunId,
    fingerprint: StationFingerprint | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.confirmed(fingerprint), at);
  }

  queueFailed(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.queueFailed(), at);
  }

  gaveUp(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.gaveUp(), at);
  }

  forgone(run: RunId, at: Date): Replay {
    return this.changing(run, (entry) => entry.forgone(), at);
  }

  refused(run: RunId, refusal: ReplayRefusal, at: Date): Replay {
    return this.changing(run, (entry) => entry.refused(refusal), at);
  }

  ended(run: RunId, end: RunEnd): Replay {
    return this.changing(run, (entry) => entry.ended(end), end.at);
  }

  measured(run: RunId, measures: EntryMeasures, at: Date): Replay {
    return this.changing(run, (entry) => entry.measured(measures), at);
  }

  reviewed(
    run: RunId,
    checks: ChangeChecks,
    drafting: ModelSpent | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.reviewed(checks, drafting), at);
  }

  judged(
    run: RunId,
    verdict: JudgeVerdict,
    spent: ModelSpent | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.judged(verdict, spent), at);
  }

  judgingFailed(
    run: RunId,
    why: string,
    spent: ModelSpent | null,
    at: Date,
  ): Replay {
    return this.changing(run, (entry) => entry.judgingFailed(why, spent), at);
  }

  rejudged(
    run: RunId,
    verdict: JudgeVerdict,
    spent: ModelSpent | null,
  ): Replay {
    return this.secondRound(run, (entry) => entry.rejudged(verdict, spent));
  }

  rejudgingFailed(run: RunId, why: string, spent: ModelSpent | null): Replay {
    return this.secondRound(run, (entry) => entry.rejudgingFailed(why, spent));
  }

  rechecked(run: RunId, checks: ChangeChecks): Replay {
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

  stopped(at: Date, by: Attribution): Replay {
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

  abandoned(): Replay {
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
    const entries = this.state.entries.map((each) => {
      if (!each.ranAs(run)) {
        return each;
      }

      const changed = change(each);

      if (!changed.wantsJudging(this.scoring)) {
        return changed.scored(this.scoring);
      }

      if (!this.isDispatching) {
        return changed
          .judgingFailed(STOPPED_BEFORE_JUDGING, null)
          .scored(this.scoring);
      }

      wanted.push(changed);
      return changed.judgingAsked().scored(this.scoring);
    });

    if (entries.every((each, place) => each === this.state.entries[place])) {
      return this;
    }

    const changed = this.with({ entries });

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
        (each) => each.isSettled && each.concludedFor(this.scoring),
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
