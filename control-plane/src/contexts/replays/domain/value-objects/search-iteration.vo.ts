import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { FailureCause } from '@replays/domain/value-objects/failure-cause.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { ReflectionResult } from '@replays/domain/value-objects/reflection-result';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import type { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const SEARCH_ITERATION_STATES = [
  'wanted',
  'running',
  'ended',
  'failed',
] as const;

export type SearchIterationState = (typeof SEARCH_ITERATION_STATES)[number];

export const SEARCH_ITERATION_KINDS = [
  'propose',
  'reflect',
  'request',
] as const;

export type SearchIterationKind = (typeof SEARCH_ITERATION_KINDS)[number];

export const ATTEMPTS_PER_PROPOSAL = 3;

interface IterationState {
  readonly number: number;
  readonly runId: RunId | null;
  readonly kind: SearchIterationKind;
  readonly state: SearchIterationState;
  readonly proposals: readonly SearchProposal[];
  readonly attempts: number;
  readonly agentSpent: ModelSpent | null;
  readonly incumbent: CandidateId | null;
  readonly reflectedOn: readonly ReflectedTask[];
  readonly causes: readonly FailureCause[];
  readonly result: ReflectionResult | null;
}

export class SearchIteration {
  private constructor(private readonly state: IterationState) {}

  static wanted(
    number: number,
    runId: RunId,
    kind: SearchIterationKind,
  ): SearchIteration {
    return new SearchIteration({
      number,
      runId,
      kind,
      state: 'wanted',
      proposals: [],
      attempts: 0,
      agentSpent: null,
      incumbent: null,
      reflectedOn: [],
      causes: [],
      result: null,
    });
  }

  static requested(number: number): SearchIteration {
    return new SearchIteration({
      number,
      runId: null,
      kind: 'request',
      state: 'wanted',
      proposals: [],
      attempts: 0,
      agentSpent: null,
      incumbent: null,
      reflectedOn: [],
      causes: [],
      result: null,
    });
  }

  static rehydrate(state: IterationState): SearchIteration {
    if (!Number.isInteger(state.number) || state.number < 1) {
      throw new InconsistentStateError(
        'search iteration',
        `is numbered ${state.number}, not from 1 up`,
      );
    }
    if ((state.kind === 'request') !== (state.runId === null)) {
      throw new InconsistentStateError(
        'search iteration',
        'has an agent run when, and only when, an agent proposes in it',
      );
    }
    if (state.attempts < state.proposals.length) {
      throw new InconsistentStateError(
        'search iteration',
        'holds more proposals than attempts',
      );
    }
    if (
      state.kind === 'reflect'
        ? state.attempts > 0
        : state.incumbent !== null ||
          state.result !== null ||
          state.reflectedOn.length > 0 ||
          state.causes.length > 0
    ) {
      throw new InconsistentStateError(
        'search iteration',
        'either proposes candidates or looks into failing tasks, not both',
      );
    }
    if (state.incumbent === null && state.reflectedOn.length > 0) {
      throw new InconsistentStateError(
        'search iteration',
        'looks into failing tasks without knowing whose failures they are',
      );
    }
    if (
      state.causes.some(
        (each, at) =>
          !state.reflectedOn.some((task) => task.isAbout(each.taskId)) ||
          state.causes.findIndex((other) => other.isAbout(each.taskId)) !== at,
      )
    ) {
      throw new InconsistentStateError(
        'search iteration',
        'has one cause for each task it looked into, and none for others',
      );
    }

    return new SearchIteration({
      ...state,
      proposals: [...state.proposals],
      reflectedOn: [...state.reflectedOn],
      causes: [...state.causes],
    });
  }

  get number(): number {
    return this.state.number;
  }

  get runId(): RunId | null {
    return this.state.runId;
  }

  get kind(): SearchIterationKind {
    return this.state.kind;
  }

  get reflects(): boolean {
    return this.state.kind === 'reflect';
  }

  get incumbent(): CandidateId | null {
    return this.state.incumbent;
  }

  get result(): ReflectionResult | null {
    return this.state.result;
  }

  get endedSearch(): boolean {
    return this.state.result !== null && this.state.result !== 'continued';
  }

  get reflectedOn(): readonly ReflectedTask[] {
    return this.state.reflectedOn;
  }

  get causes(): readonly FailureCause[] {
    return this.state.causes;
  }

  get foundConfigCause(): boolean {
    return this.state.causes.some((each) => each.configCanFix);
  }

  get current(): SearchIterationState {
    return this.state.state;
  }

  get proposals(): readonly SearchProposal[] {
    return this.state.proposals;
  }

  get attempts(): number {
    return this.state.attempts;
  }

  get agentSpent(): ModelSpent | null {
    return this.state.agentSpent;
  }

  get ownsActiveRun(): boolean {
    return (
      this.state.runId !== null &&
      (this.state.state === 'wanted' || this.state.state === 'running')
    );
  }

  get awaitsRequests(): boolean {
    return this.state.kind === 'request' && this.state.state === 'wanted';
  }

  get isClosed(): boolean {
    return (
      !this.ownsActiveRun &&
      this.state.agentSpent !== null &&
      this.state.proposals.every((each) => each.replay.hasEnded)
    );
  }

  get awaitsAgentSpend(): boolean {
    return (
      this.state.runId !== null &&
      !this.ownsActiveRun &&
      this.state.agentSpent === null
    );
  }

  agentUnpriced(ceiling: Money): boolean {
    const spent = this.state.agentSpent;

    return (
      spent !== null &&
      (spent.unpriced > 0 ||
        spent.spends.some((each) => !each.sameCurrencyAs(ceiling)))
    );
  }

  get cameToNothing(): boolean {
    return (
      !this.reflects &&
      !this.state.proposals.some((each) => each.improved === true)
    );
  }

  ran(run: RunId): boolean {
    return this.state.runId?.equals(run) ?? false;
  }

  mayPropose(max: number): boolean {
    return (
      !this.reflects &&
      this.ownsActiveRun &&
      this.state.proposals.length < max &&
      this.state.attempts < max * ATTEMPTS_PER_PROPOSAL
    );
  }

  queued(): SearchIteration {
    return this.state.state === 'wanted'
      ? this.with({ state: 'running' })
      : this;
  }

  ended(failed: boolean, started: boolean): SearchIteration {
    if (!this.ownsActiveRun) {
      return this;
    }

    return this.with({
      state: failed ? 'failed' : 'ended',
      agentSpent:
        this.state.agentSpent ?? (started ? null : ModelSpent.of([], 0)),
    });
  }

  acceptProposal(proposal: SearchProposal): SearchIteration {
    return this.with({
      proposals: [...this.state.proposals, proposal],
      attempts: this.state.attempts + 1,
    });
  }

  taken(proposals: readonly SearchProposal[]): SearchIteration {
    if (!this.awaitsRequests) {
      return this;
    }

    return this.with({
      state: 'ended',
      proposals: [...proposals],
      attempts: proposals.length,
      agentSpent: ModelSpent.of([], 0),
    });
  }

  reflectingOn(
    incumbent: CandidateId,
    tasks: readonly ReflectedTask[],
  ): SearchIteration {
    if (
      !this.reflects ||
      this.state.state !== 'wanted' ||
      this.state.incumbent !== null
    ) {
      return this;
    }

    return tasks.length > 0
      ? this.with({ incumbent, reflectedOn: [...tasks] })
      : this.with({
          incumbent,
          state: 'ended',
          agentSpent: ModelSpent.of([], 0),
          result: 'no-failures',
        });
  }

  concluded(result: ReflectionResult): SearchIteration {
    return this.state.result ? this : this.with({ result });
  }

  taskReflectedOn(taskId: TaskId): ReflectedTask | null {
    return this.state.reflectedOn.find((each) => each.isAbout(taskId)) ?? null;
  }

  causeRecorded(cause: FailureCause): SearchIteration {
    return this.with({
      causes: [
        ...this.state.causes.filter((each) => !each.isAbout(cause.taskId)),
        cause,
      ],
    });
  }

  rejected(): SearchIteration {
    return this.with({ attempts: this.state.attempts + 1 });
  }

  spentByAgent(spent: ModelSpent): SearchIteration {
    return this.state.agentSpent ? this : this.with({ agentSpent: spent });
  }

  replayEnded(
    replayId: ReplayId,
    end: ReplayStopReason,
    charge: ReplayCharge,
    improved: boolean,
  ): SearchIteration {
    const proposals = this.state.proposals.map((each) =>
      each.replayEnded(replayId, end, charge, improved),
    );

    return proposals.every((each, at) => each === this.state.proposals[at])
      ? this
      : this.with({ proposals });
  }

  replaySpent(replayId: ReplayId, charge: ReplayCharge): SearchIteration {
    const proposals = this.state.proposals.map((each) =>
      each.replaySpent(replayId, charge),
    );

    return proposals.every((each, at) => each === this.state.proposals[at])
      ? this
      : this.with({ proposals });
  }

  private with(part: Partial<IterationState>): SearchIteration {
    return new SearchIteration({ ...this.state, ...part });
  }
}
