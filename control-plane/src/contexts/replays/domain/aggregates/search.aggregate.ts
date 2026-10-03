import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type {
  ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutWanted } from '@replays/domain/events/search-holding-out-wanted.event';
import { SearchIterationWanted } from '@replays/domain/events/search-iteration-wanted.event';
import { SearchReflected } from '@replays/domain/events/search-reflected.event';
import { SearchStalledUnreflected } from '@replays/domain/events/search-stalled-unreflected.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { SearchStopAsked } from '@replays/domain/events/search-stop-asked.event';
import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { SearchCandidateNameTakenError } from '@replays/domain/exceptions/search-candidate-name-taken.error';
import { SearchEndedError } from '@replays/domain/exceptions/search-ended.error';
import { SearchIterationClosedError } from '@replays/domain/exceptions/search-iteration-closed.error';
import { SearchNotReflectingError } from '@replays/domain/exceptions/search-not-reflecting.error';
import { SearchProposalsSpentError } from '@replays/domain/exceptions/search-proposals-spent.error';
import { SearchReflectingError } from '@replays/domain/exceptions/search-reflecting.error';
import { UnknownSearchTaskError } from '@replays/domain/exceptions/unknown-search-task.error';
import { frontierOf } from '@replays/domain/services/frontier';
import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import { rankedOf } from '@replays/domain/services/search-ranking';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { ReflectionOutcome } from '@replays/domain/value-objects/reflection-outcome';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type {
  SearchAllotment,
  SearchBudget,
} from '@replays/domain/value-objects/search-budget.vo';
import { SearchCause } from '@replays/domain/value-objects/search-cause.vo';
import type {
  SearchCourseEnding,
  SearchCutShort,
  SearchEnding,
} from '@replays/domain/value-objects/search-ending';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import {
  SearchIteration,
  type SearchIterationKind,
} from '@replays/domain/value-objects/search-iteration.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import { SearchStartDetail } from '@replays/domain/value-objects/search-start-detail.vo';
import {
  ACTIVE_SEARCH_STATES,
  type SearchState,
} from '@replays/domain/value-objects/search-state';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const STALLED_AFTER = 2;

const REFLECTION_AND_ONE_MORE = 2;

const cheaperThan = (cost: number | null, seed: number | null): boolean =>
  cost !== null && seed !== null && cost < seed;

export interface SearchSeed {
  readonly candidateId: CandidateId;
  readonly fingerprint: StationFingerprint;
  readonly replay: SearchReplay;
}

export interface HeldOutReplay {
  readonly candidateId: CandidateId;
  readonly replay: SearchReplay;
}

export interface SeedCandidate {
  readonly id: CandidateId;
  readonly isLive: boolean;
  readonly fingerprint: StationFingerprint;
  isFor(stationId: string): boolean;
}

export interface RunEnding {
  readonly failed: boolean;
  readonly started: boolean;
}

export interface CauseGiven {
  readonly taskId: TaskId;
  readonly cause: unknown;
  readonly evidence: unknown;
  readonly suggestion: unknown;
}

interface Admission {
  readonly candidateId: CandidateId;
  readonly name: CandidateName;
  readonly replayId: ReplayId;
}

interface State {
  readonly id: SearchId;
  readonly station: ReplayedStation;
  readonly setId: ReplaySetId;
  readonly agent: SearchAgent;
  readonly budget: SearchBudget;
  readonly objective: SearchObjective;
  readonly split: HeldOutSplit;
  readonly seed: SearchSeed;
  readonly iterations: readonly SearchIteration[];
  readonly heldOut: readonly HeldOutReplay[];
  readonly state: SearchState;
  readonly ending: SearchEnding | null;
  readonly startedBy: UserId | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly version: number;
}

const isActive = (state: SearchState): boolean =>
  (ACTIVE_SEARCH_STATES as readonly SearchState[]).includes(state);

export class Search extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isAbandoned = false,
  ) {
    super();
  }

  static started(input: {
    id: SearchId;
    set: ReplaySet;
    agent: SearchAgent;
    budget: SearchBudget;
    objective: SearchObjective;
    split: HeldOutSplit;
    seed: { candidate: SeedCandidate; replayId: ReplayId };
    at: Date;
    by: Attribution;
  }): Search {
    const { set, seed } = input;

    set.stillAtItsStation();

    if (!input.split.covers(set.runs)) {
      throw new InvalidSearchError('splits exactly the runs of its replay set');
    }
    if (
      !seed.candidate.isLive ||
      !seed.candidate.isFor(set.station.stationId)
    ) {
      throw new InvalidSearchError(
        'starts from the live config of the station its replay set is at',
      );
    }

    input.budget.allot(input.split);

    const started = new Search({
      id: input.id,
      station: set.station,
      setId: set.id,
      agent: input.agent,
      budget: input.budget,
      objective: input.objective,
      split: input.split,
      seed: {
        candidateId: seed.candidate.id,
        fingerprint: seed.candidate.fingerprint,
        replay: SearchReplay.started(seed.replayId),
      },
      iterations: [],
      heldOut: [],
      state: 'seeding',
      ending: null,
      startedBy: input.by.actor?.principal.userId ?? null,
      startedAt: input.at,
      endedAt: null,
      version: 0,
    });

    started.record(
      new SearchStarted(
        input.id,
        set.teamId,
        ConfigurationChange.created(
          started.whatChanged,
          input.by,
          SearchStartDetail.of({
            setId: set.id,
            stationId: set.station.stationId,
            agent: input.agent,
            budget: input.budget,
            objective: input.objective,
            heldOutTasks: input.split.heldOutTasks,
          }),
        ),
      ),
    );

    return started;
  }

  static rehydrate(state: State): Search {
    const ended = state.state === 'finished' || state.state === 'stopped';

    if (ended !== (state.endedAt !== null)) {
      throw new InconsistentStateError(
        'search',
        'has an end time when, and only when, it has ended',
      );
    }
    if (
      (state.state === 'seeding' || state.state === 'searching') !==
      (state.ending === null)
    ) {
      throw new InconsistentStateError(
        'search',
        'says why it stopped searching when, and only when, it has',
      );
    }

    if (state.iterations.some((each, place) => each.number !== place + 1)) {
      throw new InconsistentStateError(
        'search',
        'numbers its iterations one after another from 1',
      );
    }
    if (
      (state.state === 'seeding' || state.state === 'searching') &&
      state.heldOut.length > 0
    ) {
      throw new InconsistentStateError(
        'search',
        'held out candidates before it stopped searching',
      );
    }

    return new Search({
      ...state,
      iterations: [...state.iterations],
      heldOut: [...state.heldOut],
    });
  }

  get id(): SearchId {
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

  get agent(): SearchAgent {
    return this.state.agent;
  }

  get budget(): SearchBudget {
    return this.state.budget;
  }

  get objective(): SearchObjective {
    return this.state.objective;
  }

  get concurrency(): number {
    return this.state.budget.concurrency;
  }

  get split(): HeldOutSplit {
    return this.state.split;
  }

  get allotment(): SearchAllotment {
    return this.state.budget.allot(this.state.split);
  }

  get seed(): SearchSeed {
    return this.state.seed;
  }

  get iterations(): readonly SearchIteration[] {
    return this.state.iterations;
  }

  get proposals(): readonly SearchProposal[] {
    return this.state.iterations.flatMap((each) => each.proposals);
  }

  get heldOut(): readonly HeldOutReplay[] {
    return this.state.heldOut;
  }

  get current(): SearchState {
    return this.state.state;
  }

  get ending(): SearchEnding | null {
    return this.state.ending;
  }

  get startedBy(): UserId | null {
    return this.state.startedBy;
  }

  get startedAt(): Date {
    return this.state.startedAt;
  }

  get endedAt(): Date | null {
    return this.state.endedAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isActive(): boolean {
    return isActive(this.state.state);
  }

  get heldRun(): RunId | null {
    const last = this.lastIteration;

    return last?.holdsItsRun ? last.runId : null;
  }

  get spent(): Spend {
    const ceiling = this.state.budget.ceiling;
    const allotment = this.allotment;
    const inCurrency = (spends: readonly Spend[]): Spend =>
      spends
        .filter((each) => each.sameCurrencyAs(ceiling))
        .reduce((sum, each) => sum.plus(each), Spend.none(ceiling.currency));
    const replays = this.replays.map((each) =>
      inCurrency(each.spent ? [each.spent] : []).plus(
        allotment.perRun.scaled(each.unpriced, 1),
      ),
    );
    const agents = this.state.iterations.map((each) => {
      const priced = inCurrency(each.agentSpent?.spends ?? []);

      return each.agentUnpriced(ceiling) && priced.isWithin(allotment.agentRun)
        ? allotment.agentRun
        : priced;
    });

    return [...replays, ...agents].reduce(
      (sum, each) => sum.plus(each),
      Spend.none(ceiling.currency),
    );
  }

  private get replays(): readonly SearchReplay[] {
    return [
      this.state.seed.replay,
      ...this.proposals.map((each) => each.replay),
      ...this.state.heldOut.map((each) => each.replay),
    ];
  }

  iterationOf(run: RunId): SearchIteration | null {
    return this.state.iterations.find((each) => each.ran(run)) ?? null;
  }

  runQueued(run: RunId): Search {
    return this.changingIteration(run, (each) => each.queued());
  }

  runEnded(
    run: RunId,
    ending: RunEnding,
    at: Date,
    runIds: () => RunId,
  ): Search {
    return this.changingIteration(run, (each) =>
      each.ended(ending.failed, ending.started),
    ).advancedAt(at, runIds);
  }

  spentByAgent(
    run: RunId,
    spent: ModelSpent,
    at: Date,
    runIds: () => RunId,
  ): Search {
    return this.changingIteration(run, (each) =>
      each.spentByAgent(spent),
    ).advancedAt(at, runIds);
  }

  get wantedIteration(): SearchIteration | null {
    const last = this.lastIteration;

    return this.isActive && last?.current === 'wanted' ? last : null;
  }

  get wantsHoldingOut(): boolean {
    return (
      this.state.state === 'holding-out' && this.state.heldOut.length === 0
    );
  }

  get awaitingAgentSpend(): readonly SearchIteration[] {
    return this.state.iterations.filter((each) => each.awaitsAgentSpend);
  }

  get replayIds(): readonly ReplayId[] {
    return this.replays.map((each) => each.replayId);
  }

  get unendedReplays(): readonly ReplayId[] {
    return this.replays
      .filter((each) => !each.hasEnded)
      .map((each) => each.replayId);
  }

  admitted(run: RunId, admission: Admission): Search {
    const iteration = this.proposingIn(run);

    if (this.proposals.some((each) => each.isNamed(admission.name))) {
      throw new SearchCandidateNameTakenError(admission.name.value);
    }

    return this.changingIteration(run, () =>
      iteration.admitted(
        SearchProposal.of({
          candidateId: admission.candidateId,
          name: admission.name,
          replay: SearchReplay.started(admission.replayId),
          improved: null,
        }),
      ),
    );
  }

  reflectingOn(
    run: RunId,
    standing: CandidateId,
    tasks: readonly ReflectedTask[],
    at: Date,
    runIds: () => RunId,
  ): Search {
    const iteration = this.iterationOf(run);

    if (!iteration?.reflects || iteration.current !== 'wanted') {
      throw new InvalidSearchError(
        'looks into failing tasks only in a reflection it has yet to run',
      );
    }
    if (
      !tasks.every((task) =>
        this.state.split.searched.some(
          (each) =>
            each.taskId.equals(task.taskId) &&
            each.runId.equals(task.originalRunId),
        ),
      )
    ) {
      throw new InvalidSearchError(
        'looks only into the tasks it searched, never the held-out ones',
      );
    }

    if (
      !standing.equals(this.state.seed.candidateId) &&
      !this.proposals.some((each) => each.candidateId.equals(standing))
    ) {
      throw new InvalidSearchError(
        'looks into the failures of its seed or of a candidate it proposed',
      );
    }

    return this.changingIteration(run, (each) =>
      each.reflectingOn(standing, tasks),
    ).advancedAt(at, runIds);
  }

  causeRecorded(run: RunId, given: CauseGiven, at: Date): Search {
    const iteration = this.iterationOf(run);

    if (this.state.state !== 'searching' || !iteration?.holdsItsRun) {
      throw new SearchIterationClosedError(run.value);
    }
    if (!iteration.reflects) {
      throw new SearchNotReflectingError();
    }

    const task = iteration.taskReflectedOn(given.taskId);

    if (!task) {
      throw new UnknownSearchTaskError(given.taskId.value);
    }

    const cause = SearchCause.of({ task, ...given, at });

    return this.changingIteration(run, (each) => each.causeRecorded(cause));
  }

  proposalRefused(run: RunId): Search {
    const iteration = this.proposingIn(run);

    return this.changingIteration(run, () => iteration.refused());
  }

  replayEnded(
    replayId: ReplayId,
    end: ReplayEnd,
    charge: ReplayCharge,
    at: Date,
    runIds: () => RunId,
    improved: boolean,
  ): Search {
    const { seed } = this.state;

    if (seed.replay.is(replayId)) {
      if (seed.replay.hasEnded) {
        return this.replaySpent(replayId, charge);
      }

      const noted = this.with({
        seed: { ...seed, replay: seed.replay.endedAs(end, charge) },
      });

      if (this.state.state !== 'seeding') {
        return noted;
      }
      if (end === 'finished') {
        return noted.searchingAt(at, runIds);
      }

      return end === 'over-budget'
        ? noted.with({ state: 'searching' }).ranItsCourse('ceiling-reached', at)
        : noted.cutShort('seed-failed', at);
    }

    if (this.state.heldOut.some((each) => each.replay.is(replayId))) {
      return this.with({
        heldOut: this.state.heldOut.map((each) =>
          each.replay.is(replayId)
            ? { ...each, replay: each.replay.endedAs(end, charge) }
            : each,
        ),
      }).heldOutAt(at);
    }

    const iterations = this.state.iterations.map((each) =>
      each.replayEnded(replayId, end, charge, improved),
    );

    return iterations.every(
      (each, place) => each === this.state.iterations[place],
    )
      ? this
      : this.with({ iterations }).advancedAt(at, runIds);
  }

  replaySpent(replayId: ReplayId, charge: ReplayCharge): Search {
    const { seed } = this.state;
    const seedReplay = seed.replay.spentAs(charge);
    const heldOut = this.state.heldOut.map((each) => {
      const replay = each.replay.is(replayId)
        ? each.replay.spentAs(charge)
        : each.replay;

      return replay === each.replay ? each : { ...each, replay };
    });
    const iterations = this.state.iterations.map((each) =>
      each.replaySpent(replayId, charge),
    );
    const changed =
      (seed.replay.is(replayId) && seedReplay !== seed.replay) ||
      heldOut.some((each, place) => each !== this.state.heldOut[place]) ||
      iterations.some((each, place) => each !== this.state.iterations[place]);

    return changed
      ? this.with({
          seed: seed.replay.is(replayId)
            ? { ...seed, replay: seedReplay }
            : seed,
          heldOut,
          iterations,
        })
      : this;
  }

  heldOutFrom(
    replays: readonly Replay[],
    minGain: number,
    replayIds: () => ReplayId,
    at: Date,
  ): Search {
    if (this.state.state !== 'holding-out' || this.state.heldOut.length > 0) {
      throw new InvalidSearchError(
        'holds out its candidates once, after it stopped searching',
      );
    }

    const scores = scoresOf(this, replays, minGain);
    const { objective } = this.state;
    const chosen = rankedOf(
      frontierOf([scores.seed, ...scores.candidates], objective).filter(
        (each) =>
          !each.seed &&
          (objective === 'success' ||
            cheaperThan(each.costPerRun, scores.seed.costPerRun)) &&
          this.proposals.some(
            (proposal) =>
              proposal.candidateId.equals(each.candidateId) &&
              proposal.replay.hasFinished,
          ),
      ),
      objective,
    ).slice(0, this.state.budget.perIteration);

    return this.with({
      heldOut: chosen.map((each) => ({
        candidateId: each.candidateId,
        replay: SearchReplay.started(replayIds()),
      })),
    }).heldOutAt(at);
  }

  stopped(at: Date, by: Attribution): Search {
    if (!this.isActive) {
      throw new SearchEndedError(this.id.value);
    }

    const stopped = this.cutShort('stopped', at);

    stopped.record(
      new SearchStopAsked(
        this.id,
        this.teamId,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return stopped;
  }

  stationLeft(at: Date): Search {
    return this.isActive ? this.cutShort('station-gone', at) : this;
  }

  setGone(at: Date): Search {
    return this.isActive ? this.cutShort('set-gone', at) : this;
  }

  abandoned(): Search {
    const abandoned = new Search(this.state, true);

    abandoned.inheritEvents(this);

    return abandoned;
  }

  private get whatChanged() {
    return {
      resource: 'replay-search' as const,
      id: this.id.value,
      key: this.id.value,
    };
  }

  private get lastIteration(): SearchIteration | null {
    return this.state.iterations[this.state.iterations.length - 1] ?? null;
  }

  private proposingIn(run: RunId): SearchIteration {
    const iteration = this.iterationOf(run);

    if (
      this.state.state !== 'searching' ||
      !iteration ||
      !iteration.holdsItsRun
    ) {
      throw new SearchIterationClosedError(run.value);
    }
    if (iteration.reflects) {
      throw new SearchReflectingError();
    }
    if (!iteration.mayPropose(this.state.budget.perIteration)) {
      throw new SearchProposalsSpentError(this.state.budget.perIteration);
    }

    return iteration;
  }

  private changingIteration(
    run: RunId,
    change: (iteration: SearchIteration) => SearchIteration,
  ): Search {
    let changed = false;
    const iterations = this.state.iterations.map((each) => {
      if (!each.ran(run)) {
        return each;
      }

      const next = change(each);
      changed = next !== each;
      return next;
    });

    return changed ? this.with({ iterations }) : this;
  }

  private searchingAt(at: Date, runIds: () => RunId): Search {
    const searching = this.with({ state: 'searching' });

    return searching.affordsIteration
      ? searching.wantingIteration(runIds, 'propose')
      : searching.ranItsCourse('ceiling-reached', at);
  }

  private get affordsIteration(): boolean {
    return this.state.budget.allowsIteration(this.spent, this.state.split);
  }

  private advancedAt(at: Date, runIds: () => RunId): Search {
    const last = this.lastIteration;

    if (this.state.state !== 'searching' || !last?.isClosed) {
      return this;
    }
    if (last.reflects) {
      return this.reflectedAt(last, at, runIds);
    }
    if (this.state.iterations.length >= this.state.budget.iterations) {
      return this.ranItsCourse('iterations-spent', at);
    }
    if (this.stalls) {
      return this.roomToReflect
        ? this.wantingIteration(runIds, 'reflect')
        : this.stalledUnreflected(at);
    }
    if (!this.affordsIteration) {
      return this.ranItsCourse('ceiling-reached', at);
    }

    return this.wantingIteration(runIds, 'propose');
  }

  private get roomToReflect(): boolean {
    const { budget, split, iterations } = this.state;

    return (
      budget.iterations - iterations.length >= REFLECTION_AND_ONE_MORE &&
      budget.allowsIteration(this.spent.plus(this.allotment.agentRun), split)
    );
  }

  private get stalls(): boolean {
    const recent = this.state.iterations.slice(-STALLED_AFTER);

    return (
      recent.length === STALLED_AFTER &&
      recent.every((each) => each.cameToNothing)
    );
  }

  private stalledUnreflected(at: Date): Search {
    const stalled = this.ranItsCourse('stalled', at);

    stalled.record(new SearchStalledUnreflected(this.id, this.workspaceId));

    return stalled;
  }

  private reflectedAt(
    reflection: SearchIteration,
    at: Date,
    runIds: () => RunId,
  ): Search {
    const stalledAs: ReflectionOutcome | null =
      reflection.outcome ??
      (reflection.foundConfigCause
        ? null
        : reflection.causes.length === 0 && reflection.current === 'failed'
          ? 'did-not-run'
          : 'no-config-cause');
    const next = stalledAs
      ? this.ranItsCourse('stalled', at)
      : this.state.iterations.length >= this.state.budget.iterations
        ? this.ranItsCourse('iterations-spent', at)
        : this.affordsIteration
          ? this.wantingIteration(runIds, 'propose')
          : this.ranItsCourse('ceiling-reached', at);
    const outcome =
      stalledAs ??
      (next.state.state === 'searching' ? 'went-on' : 'out-of-budget');
    const concluded = next.changingIteration(reflection.runId, (each) =>
      each.concluded(outcome),
    );

    concluded.record(
      new SearchReflected(
        this.id,
        this.workspaceId,
        reflection.number,
        outcome !== 'went-on',
      ),
    );

    return concluded;
  }

  private wantingIteration(
    runIds: () => RunId,
    kind: SearchIterationKind,
  ): Search {
    const number = this.state.iterations.length + 1;
    const iteration = SearchIteration.wanted(number, runIds(), kind);
    const wanting = this.with({
      iterations: [...this.state.iterations, iteration],
    });

    wanting.record(
      new SearchIterationWanted(
        this.id,
        this.workspaceId,
        number,
        iteration.runId,
      ),
    );

    return wanting;
  }

  private ranItsCourse(ending: SearchCourseEnding, at: Date): Search {
    if (!this.proposals.some((each) => each.replay.hasFinished)) {
      return this.endedAs('finished', ending, at);
    }

    const holding = this.with({ state: 'holding-out', ending });

    holding.record(new SearchHoldingOutWanted(this.id, this.workspaceId));

    return holding;
  }

  private heldOutAt(at: Date): Search {
    const ending = this.state.ending;

    return this.state.state === 'holding-out' &&
      ending !== null &&
      this.state.heldOut.every((each) => each.replay.hasEnded)
      ? this.endedAs('finished', ending, at)
      : this;
  }

  private cutShort(ending: SearchCutShort, at: Date): Search {
    return this.endedAs('stopped', ending, at);
  }

  private endedAs(
    state: 'finished' | 'stopped',
    ending: SearchEnding,
    at: Date,
  ): Search {
    const withdrawing = this.heldRun;
    const stopping = [
      this.state.seed.replay,
      ...this.proposals.map((each) => each.replay),
      ...this.state.heldOut.map((each) => each.replay),
    ]
      .filter((each) => !each.hasEnded)
      .map((each) => each.replayId);
    const ended = this.with({ state, ending, endedAt: at });

    ended.record(
      new SearchEnded(
        this.id,
        this.workspaceId,
        state,
        ending,
        withdrawing,
        stopping,
      ),
    );

    return ended;
  }

  private with(part: Partial<State>): Search {
    const next = new Search({ ...this.state, ...part }, this.isAbandoned);

    next.inheritEvents(this);

    return next;
  }
}
