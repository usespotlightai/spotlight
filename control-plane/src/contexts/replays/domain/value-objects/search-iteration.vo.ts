import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { ReflectionOutcome } from '@replays/domain/value-objects/reflection-outcome';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import type { SearchCause } from '@replays/domain/value-objects/search-cause.vo';
import type { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import type { Spend } from '@replays/domain/value-objects/spend.vo';
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

export const SEARCH_ITERATION_KINDS = ['propose', 'reflect'] as const;

export type SearchIterationKind = (typeof SEARCH_ITERATION_KINDS)[number];

export const ATTEMPTS_PER_PROPOSAL = 3;

interface IterationState {
  readonly number: number;
  readonly runId: RunId;
  readonly kind: SearchIterationKind;
  readonly state: SearchIterationState;
  readonly proposals: readonly SearchProposal[];
  readonly attempts: number;
  readonly agentSpent: ModelSpent | null;
  readonly incumbent: CandidateId | null;
  readonly reflectedOn: readonly ReflectedTask[];
  readonly causes: readonly SearchCause[];
  readonly outcome: ReflectionOutcome | null;
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
      outcome: null,
    });
  }

  static rehydrate(state: IterationState): SearchIteration {
    if (!Number.isInteger(state.number) || state.number < 1) {
      throw new InconsistentStateError(
        'search iteration',
        `is numbered ${state.number}, not from 1 up`,
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
          state.outcome !== null ||
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

  get runId(): RunId {
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

  get outcome(): ReflectionOutcome | null {
    return this.state.outcome;
  }

  get endedSearch(): boolean {
    return this.state.outcome !== null && this.state.outcome !== 'went-on';
  }

  get reflectedOn(): readonly ReflectedTask[] {
    return this.state.reflectedOn;
  }

  get causes(): readonly SearchCause[] {
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
    return this.state.state === 'wanted' || this.state.state === 'running';
  }

  get isClosed(): boolean {
    return (
      !this.ownsActiveRun &&
      this.state.agentSpent !== null &&
      this.state.proposals.every((each) => each.replay.hasEnded)
    );
  }

  get awaitsAgentSpend(): boolean {
    return !this.ownsActiveRun && this.state.agentSpent === null;
  }

  agentUnpriced(ceiling: Spend): boolean {
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
    return this.state.runId.equals(run);
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

  admitted(proposal: SearchProposal): SearchIteration {
    return this.with({
      proposals: [...this.state.proposals, proposal],
      attempts: this.state.attempts + 1,
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
          outcome: 'no-failures',
        });
  }

  concluded(outcome: ReflectionOutcome): SearchIteration {
    return this.state.outcome ? this : this.with({ outcome });
  }

  taskReflectedOn(taskId: TaskId): ReflectedTask | null {
    return this.state.reflectedOn.find((each) => each.isAbout(taskId)) ?? null;
  }

  causeRecorded(cause: SearchCause): SearchIteration {
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
    end: ReplayEnd,
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
