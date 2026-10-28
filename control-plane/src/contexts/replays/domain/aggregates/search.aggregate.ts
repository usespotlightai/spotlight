import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type {
  ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutRequested } from '@replays/domain/events/search-holding-out-requested.event';
import { SearchIterationRequested } from '@replays/domain/events/search-iteration-requested.event';
import { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { SearchStopRequested } from '@replays/domain/events/search-stop-requested.event';
import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { SearchCandidateNameTakenError } from '@replays/domain/exceptions/search-candidate-name-taken.error';
import { SearchEndedError } from '@replays/domain/exceptions/search-ended.error';
import { SearchIterationClosedError } from '@replays/domain/exceptions/search-iteration-closed.error';
import { SearchNotReflectingError } from '@replays/domain/exceptions/search-not-reflecting.error';
import { SearchProposalsExhaustedError } from '@replays/domain/exceptions/search-proposals-exhausted.error';
import { SearchReflectingError } from '@replays/domain/exceptions/search-reflecting.error';
import { UnknownSearchTaskError } from '@replays/domain/exceptions/unknown-search-task.error';
import { frontierOf } from '@replays/domain/services/frontier';
import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import { rankedOf } from '@replays/domain/services/search-ranking';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { FailureCause } from '@replays/domain/value-objects/failure-cause.vo';
import type { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { ReflectionResult } from '@replays/domain/value-objects/reflection-result';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type {
  SearchBudget,
  SearchCeilingSplit,
} from '@replays/domain/value-objects/search-budget.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import {
  SearchIteration,
  type SearchIterationKind,
} from '@replays/domain/value-objects/search-iteration.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type {
  SearchPick,
  SearchPickDecline,
} from '@replays/domain/value-objects/search-pick';
import { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import { SearchStartDetail } from '@replays/domain/value-objects/search-start-detail.vo';
import {
  ACTIVE_SEARCH_STATES,
  type SearchState,
} from '@replays/domain/value-objects/search-state';
import type {
  SearchCourseStopReason,
  SearchCutShort,
  SearchStopReason,
} from '@replays/domain/value-objects/search-stop-reason';
import type { SearchTrigger } from '@replays/domain/value-objects/search-trigger';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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

export interface CauseInput {
  readonly taskId: TaskId;
  readonly cause: unknown;
  readonly evidence: unknown;
  readonly suggestion: unknown;
}

interface AcceptedProposal {
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
  readonly stopReason: SearchStopReason | null;
  readonly trigger: SearchTrigger;
  readonly pick: SearchPick | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly version: number;
}

const isActive = (state: SearchState): boolean =>
  (ACTIVE_SEARCH_STATES as readonly SearchState[]).includes(state);

export class Search extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static start(input: {
    id: SearchId;
    set: ReplaySet;
    agent: SearchAgent;
    budget: SearchBudget;
    objective: SearchObjective;
    split: HeldOutSplit;
    seed: { candidate: SeedCandidate; replayId: ReplayId };
    trigger: SearchTrigger;
    at: Date;
    by: ChangeActor;
  }): Search {
    const { set, seed } = input;

    set.stillAtItsStation();

    if (!input.split.covers(set.runs)) {
      throw new InvalidSearchError(
        'must split exactly the runs of its replay set',
      );
    }
    if (
      !seed.candidate.isLive ||
      !seed.candidate.isFor(set.station.stationId)
    ) {
      throw new InvalidSearchError(
        'must start from the live config of its replay set’s station',
      );
    }

    input.budget.splitCeiling(input.split);

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
      stopReason: null,
      trigger: input.trigger,
      pick: null,
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
      (state.stopReason === null)
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

    if (state.pick !== null && state.state !== 'finished') {
      throw new InconsistentStateError(
        'search',
        'picks a candidate only once it has finished',
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

  get ceilingSplit(): SearchCeilingSplit {
    return this.state.budget.splitCeiling(this.state.split);
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

  get stopReason(): SearchStopReason | null {
    return this.state.stopReason;
  }

  get trigger(): SearchTrigger {
    return this.state.trigger;
  }

  get pick(): SearchPick | null {
    return this.state.pick;
  }

  get awaitsPick(): boolean {
    return this.state.state === 'finished' && this.state.pick === null;
  }

  get pickedCandidate(): CandidateId | null {
    return this.state.pick?.outcome === 'picked'
      ? this.state.pick.candidateId
      : null;
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

  get activeRun(): RunId | null {
    const last = this.lastIteration;

    return last?.ownsActiveRun ? last.runId : null;
  }

  get spent(): Money {
    const ceiling = this.state.budget.ceiling;
    const ceilingSplit = this.ceilingSplit;
    const inCurrency = (spends: readonly Money[]): Money =>
      spends
        .filter((each) => each.sameCurrencyAs(ceiling))
        .reduce((sum, each) => sum.plus(each), Money.none(ceiling.currency));
    const replays = this.replays.map((each) =>
      inCurrency(each.spent ? [each.spent] : []).plus(
        ceilingSplit.perRun.scaled(each.unpriced, 1),
      ),
    );
    const agents = this.state.iterations.map((each) => {
      const priced = inCurrency(each.agentSpent?.spends ?? []);

      return each.agentUnpriced(ceiling) &&
        priced.isWithin(ceilingSplit.agentRun)
        ? ceilingSplit.agentRun
        : priced;
    });

    return [...replays, ...agents].reduce(
      (sum, each) => sum.plus(each),
      Money.none(ceiling.currency),
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

  queueRun(run: RunId): Search {
    return this.changingIteration(run, (each) => each.queued());
  }

  recordRunEnd(
    run: RunId,
    ending: RunEnding,
    at: Date,
    runIds: () => RunId,
  ): Search {
    return this.changingIteration(run, (each) =>
      each.ended(ending.failed, ending.started),
    ).advancedAt(at, runIds);
  }

  recordAgentSpend(
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

  acceptProposal(run: RunId, proposal: AcceptedProposal): Search {
    const iteration = this.proposingIn(run);

    if (this.proposals.some((each) => each.isNamed(proposal.name))) {
      throw new SearchCandidateNameTakenError(proposal.name.value);
    }

    return this.changingIteration(run, () =>
      iteration.acceptProposal(
        SearchProposal.of({
          candidateId: proposal.candidateId,
          name: proposal.name,
          replay: SearchReplay.started(proposal.replayId),
          improved: null,
        }),
      ),
    );
  }

  reflectingOn(
    run: RunId,
    incumbent: CandidateId,
    tasks: readonly ReflectedTask[],
    at: Date,
    runIds: () => RunId,
  ): Search {
    const iteration = this.iterationOf(run);

    if (!iteration?.reflects || iteration.current !== 'wanted') {
      throw new InvalidSearchError(
        'can look into failing tasks only in a pending reflection',
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
        'can look only into searched tasks, not held-out ones',
      );
    }

    if (
      !incumbent.equals(this.state.seed.candidateId) &&
      !this.proposals.some((each) => each.candidateId.equals(incumbent))
    ) {
      throw new InvalidSearchError(
        'can look only into failures of its seed or its candidates',
      );
    }

    return this.changingIteration(run, (each) =>
      each.reflectingOn(incumbent, tasks),
    ).advancedAt(at, runIds);
  }

  recordCause(run: RunId, input: CauseInput, at: Date): Search {
    const iteration = this.iterationOf(run);

    if (this.state.state !== 'searching' || !iteration?.ownsActiveRun) {
      throw new SearchIterationClosedError(run.value);
    }
    if (!iteration.reflects) {
      throw new SearchNotReflectingError();
    }

    const task = iteration.taskReflectedOn(input.taskId);

    if (!task) {
      throw new UnknownSearchTaskError(input.taskId.value);
    }

    const cause = FailureCause.of({ task, ...input, at });

    return this.changingIteration(run, (each) => each.causeRecorded(cause));
  }

  proposalRejected(run: RunId): Search {
    const iteration = this.proposingIn(run);

    return this.changingIteration(run, () => iteration.rejected());
  }

  recordReplayStopReason(
    replayId: ReplayId,
    end: ReplayStopReason,
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

      return end === 'ceiling-reached'
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
        'can hold out its candidates only once, after searching stops',
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

  stop(at: Date, by: ChangeActor): Search {
    if (!this.isActive) {
      throw new SearchEndedError(this.id.value);
    }

    const stopped = this.cutShort('stopped', at);

    stopped.record(
      new SearchStopRequested(
        this.id,
        this.teamId,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return stopped;
  }

  picked(pick: SearchPick): Search {
    if (this.state.state !== 'finished' || this.state.pick !== null) {
      throw new InvalidSearchError(
        'picks a candidate once, after it has finished',
      );
    }
    if (
      pick.outcome === 'picked' &&
      !this.proposals.some((each) => each.candidateId.equals(pick.candidateId))
    ) {
      throw new InvalidSearchError('picks only a candidate it proposed');
    }

    const recorded = this.with({ pick });

    recorded.record(
      pick.outcome === 'picked'
        ? new SearchCandidatePicked(this.id, this.workspaceId, pick.candidateId)
        : new SearchPickDeclined(this.id, this.workspaceId, pick.reason),
    );

    return recorded;
  }

  pickWithdrawn(reason: SearchPickDecline): Search {
    if (this.state.pick?.outcome !== 'picked') {
      throw new InvalidSearchError('withdraws only a pick it made');
    }

    const withdrawn = this.with({ pick: { outcome: 'declined', reason } });

    withdrawn.record(new SearchPickDeclined(this.id, this.workspaceId, reason));

    return withdrawn;
  }

  stationLeft(at: Date): Search {
    return this.isActive ? this.cutShort('station-gone', at) : this;
  }

  delete(): Search {
    const deleted = new Search(this.state, true);

    deleted.inheritEvents(this);

    return deleted;
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
      !iteration.ownsActiveRun
    ) {
      throw new SearchIterationClosedError(run.value);
    }
    if (iteration.reflects) {
      throw new SearchReflectingError();
    }
    if (!iteration.mayPropose(this.state.budget.perIteration)) {
      throw new SearchProposalsExhaustedError(this.state.budget.perIteration);
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
        : this.ranItsCourse('stalled', at);
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
      budget.allowsIteration(this.spent.plus(this.ceilingSplit.agentRun), split)
    );
  }

  private get stalls(): boolean {
    const recent = this.state.iterations.slice(-STALLED_AFTER);

    return (
      recent.length === STALLED_AFTER &&
      recent.every((each) => each.cameToNothing)
    );
  }

  private reflectedAt(
    reflection: SearchIteration,
    at: Date,
    runIds: () => RunId,
  ): Search {
    const stalledAs: ReflectionResult | null =
      reflection.result ??
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
      (next.state.state === 'searching' ? 'continued' : 'ceiling-reached');
    return next.changingIteration(reflection.runId, (each) =>
      each.concluded(outcome),
    );
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
      new SearchIterationRequested(
        this.id,
        this.workspaceId,
        number,
        iteration.runId,
      ),
    );

    return wanting;
  }

  private ranItsCourse(stopReason: SearchCourseStopReason, at: Date): Search {
    if (!this.proposals.some((each) => each.replay.hasFinished)) {
      return this.endedAs('finished', stopReason, at);
    }

    const holdingOut = this.with({ state: 'holding-out', stopReason });

    holdingOut.record(new SearchHoldingOutRequested(this.id, this.workspaceId));

    return holdingOut;
  }

  private heldOutAt(at: Date): Search {
    const stopReason = this.state.stopReason;

    return this.state.state === 'holding-out' &&
      stopReason !== null &&
      this.state.heldOut.every((each) => each.replay.hasEnded)
      ? this.endedAs('finished', stopReason, at)
      : this;
  }

  private cutShort(stopReason: SearchCutShort, at: Date): Search {
    return this.endedAs('stopped', stopReason, at);
  }

  private endedAs(
    state: 'finished' | 'stopped',
    stopReason: SearchStopReason,
    at: Date,
  ): Search {
    const runToCancel = this.activeRun;
    const stopping = [
      this.state.seed.replay,
      ...this.proposals.map((each) => each.replay),
      ...this.state.heldOut.map((each) => each.replay),
    ]
      .filter((each) => !each.hasEnded)
      .map((each) => each.replayId);
    const ended = this.with({ state, stopReason, endedAt: at });

    ended.record(
      new SearchEnded(
        this.id,
        this.workspaceId,
        state,
        stopReason,
        runToCancel,
        stopping,
      ),
    );

    return ended;
  }

  private with(part: Partial<State>): Search {
    const next = new Search({ ...this.state, ...part }, this.isDeleted);

    next.inheritEvents(this);

    return next;
  }
}
