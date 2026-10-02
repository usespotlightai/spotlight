import type {
  ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
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
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { RunEnd } from '@replays/domain/value-objects/run-end.vo';
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
  readonly judges: boolean;
  readonly checksChanges: boolean;
  readonly rubricVersion: string | null;
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
  readonly ceiling: Spend;
  readonly state: ReplayState;
  readonly entries: readonly ReplayEntry[];
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly stoppedAt: Date | null;
  readonly version: number;
}

const DISPATCHING: readonly ReplayState[] = ['queued', 'running'];

const STOPPED_BEFORE_JUDGING = 'stopped-before-judging';

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
  }): Replay {
    const { set } = input;
    const wanting = input.wanting ?? null;

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

    const started = new Replay({
      id: input.id,
      station: set.station,
      setId: set.id,
      candidateId: input.candidate.id,
      baseline: input.baseline,
      judges: input.candidate.judges,
      checked: input.candidate.checksChanges,
      rubricVersion: input.candidate.rubricVersion,
      ceiling: input.ceiling,
      state: 'queued',
      entries: set.entries.map((each, position) =>
        ReplayEntry.waiting({
          position,
          original: each.runId,
          taskId: each.taskId,
        }),
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

  get scoring(): Scoring {
    return { judges: this.state.judges, checks: this.state.checked };
  }

  get ceiling(): Spend {
    return this.state.ceiling;
  }

  get current(): ReplayState {
    return this.state.state;
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
    return this.state.entries.map((each) => each.original);
  }

  get spent(): Spend {
    const ceiling = this.state.ceiling;

    return (
      this.everySpend.spends.find((each) => each.sameCurrencyAs(ceiling)) ??
      Spend.none(ceiling.currency)
    );
  }

  get spentElsewhere(): readonly Spend[] {
    return this.everySpend.spends
      .filter((each) => !each.sameCurrencyAs(this.state.ceiling))
      .sort((one, other) => (one.currency < other.currency ? -1 : 1));
  }

  get unpricedCalls(): number {
    return this.everySpend.unpriced;
  }

  private get everySpend(): ModelSpent {
    return this.state.entries.reduce(
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

    return abandoned;
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

    return changed.overBudgetAt(at).finishedAt(at);
  }

  private overBudgetAt(at: Date): Replay {
    if (!this.isDispatching || !this.spent.reaches(this.state.ceiling)) {
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

    return over;
  }

  private finishedAt(at: Date): Replay {
    return this.isDispatching &&
      this.state.entries.every(
        (each) => each.isSettled && each.concludedFor(this.scoring),
      )
      ? this.with({ state: 'finished', endedAt: at })
      : this;
  }

  private with(part: Partial<State>): Replay {
    const next = new Replay({ ...this.state, ...part }, this.isAbandoned);

    next.inheritEvents(this);

    return next;
  }
}
