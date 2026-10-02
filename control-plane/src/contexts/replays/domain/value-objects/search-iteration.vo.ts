import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import type { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import type { Spend } from '@replays/domain/value-objects/spend.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const SEARCH_ITERATION_STATES = [
  'wanted',
  'running',
  'ended',
  'failed',
] as const;

export type SearchIterationState = (typeof SEARCH_ITERATION_STATES)[number];

export const ATTEMPTS_PER_PROPOSAL = 3;

interface IterationState {
  readonly number: number;
  readonly runId: RunId;
  readonly state: SearchIterationState;
  readonly proposals: readonly SearchProposal[];
  readonly attempts: number;
  readonly agentSpent: ModelSpent | null;
}

export class SearchIteration {
  private constructor(private readonly state: IterationState) {}

  static wanted(number: number, runId: RunId): SearchIteration {
    return new SearchIteration({
      number,
      runId,
      state: 'wanted',
      proposals: [],
      attempts: 0,
      agentSpent: null,
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
        'took more candidates than it was offered',
      );
    }

    return new SearchIteration({ ...state, proposals: [...state.proposals] });
  }

  get number(): number {
    return this.state.number;
  }

  get runId(): RunId {
    return this.state.runId;
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

  get holdsItsRun(): boolean {
    return this.state.state === 'wanted' || this.state.state === 'running';
  }

  get isClosed(): boolean {
    return (
      !this.holdsItsRun &&
      this.state.agentSpent !== null &&
      this.state.proposals.every((each) => each.replay.hasEnded)
    );
  }

  get awaitsAgentSpend(): boolean {
    return !this.holdsItsRun && this.state.agentSpent === null;
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
      this.state.state === 'failed' ||
      !this.state.proposals.some((each) => each.replay.hasFinished)
    );
  }

  ran(run: RunId): boolean {
    return this.state.runId.equals(run);
  }

  mayPropose(most: number): boolean {
    return (
      this.holdsItsRun &&
      this.state.proposals.length < most &&
      this.state.attempts < most * ATTEMPTS_PER_PROPOSAL
    );
  }

  queued(): SearchIteration {
    return this.state.state === 'wanted'
      ? this.with({ state: 'running' })
      : this;
  }

  ended(failed: boolean, started: boolean): SearchIteration {
    if (!this.holdsItsRun) {
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

  refused(): SearchIteration {
    return this.with({ attempts: this.state.attempts + 1 });
  }

  spentByAgent(spent: ModelSpent): SearchIteration {
    return this.state.agentSpent ? this : this.with({ agentSpent: spent });
  }

  replayEnded(
    replayId: ReplayId,
    end: ReplayEnd,
    charge: ReplayCharge,
  ): SearchIteration {
    const proposals = this.state.proposals.map((each) =>
      each.replayEnded(replayId, end, charge),
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
