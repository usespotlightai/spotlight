import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type {
  UpkeepChange,
  UpkeepFinding,
  UpkeepProposalState,
} from '@memory/domain/value-objects/upkeep-change';
import type { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const MAX_UPKEEP_REASON = 500;

const FINDINGS_OF: Record<UpkeepChange, readonly UpkeepFinding[]> = {
  retire: ['path-gone', 'repository-gone', 'unused', 'wrong'],
  merge: ['overlap'],
};

interface UpkeepProposalFields {
  readonly id: UpkeepProposalId;
  readonly change: UpkeepChange;
  readonly finding: UpkeepFinding;
  readonly memories: readonly MemoryId[];
  readonly body: MemoryBody | null;
  readonly reason: string;
  readonly state: UpkeepProposalState;
  readonly decision: MemoryDecision | null;
}

const reasonOf = (raw: string): string => {
  const reason = raw.replace(/\s+/g, ' ').trim();

  if (reason.length === 0) {
    throw new InvalidMemoryError('says why', 'memory upkeep proposal');
  }

  return reason.length > MAX_UPKEEP_REASON
    ? `${reason.slice(0, MAX_UPKEEP_REASON - 1)}…`
    : reason;
};

export class UpkeepProposal {
  private constructor(private readonly s: UpkeepProposalFields) {}

  static retiring(input: {
    id: UpkeepProposalId;
    memory: MemoryId;
    finding: UpkeepFinding;
    reason: string;
  }): UpkeepProposal {
    return UpkeepProposal.proposed({
      id: input.id,
      change: 'retire',
      finding: input.finding,
      memories: [input.memory],
      body: null,
      reason: input.reason,
    });
  }

  static merging(input: {
    id: UpkeepProposalId;
    memories: readonly MemoryId[];
    body: MemoryBody;
    reason: string;
  }): UpkeepProposal {
    return UpkeepProposal.proposed({
      id: input.id,
      change: 'merge',
      finding: 'overlap',
      memories: input.memories,
      body: input.body,
      reason: input.reason,
    });
  }

  private static proposed(input: {
    id: UpkeepProposalId;
    change: UpkeepChange;
    finding: UpkeepFinding;
    memories: readonly MemoryId[];
    body: MemoryBody | null;
    reason: string;
  }): UpkeepProposal {
    return UpkeepProposal.rehydrate({
      ...input,
      reason: reasonOf(input.reason),
      state: 'pending',
      decision: null,
    });
  }

  static rehydrate(state: UpkeepProposalFields): UpkeepProposal {
    const fail = (why: string) =>
      new InconsistentStateError('memory upkeep proposal', why);
    const distinct = new Set(state.memories.map((each) => each.value)).size;

    if (!FINDINGS_OF[state.change].includes(state.finding)) {
      throw fail(`cannot ${state.change} a memory for ${state.finding}`);
    }
    if (distinct !== state.memories.length || distinct === 0) {
      throw fail('names no memory, or one memory twice');
    }
    if ((state.change === 'merge') !== distinct > 1) {
      throw fail('merges fewer than two memories, or changes more than one');
    }
    if ((state.change === 'merge') !== (state.body !== null)) {
      throw fail('has a body without merging, or merges without one');
    }
    if ((state.state === 'pending') !== (state.decision === null)) {
      throw fail('is decided without a decision, or pending with one');
    }

    return new UpkeepProposal(state);
  }

  get id(): UpkeepProposalId {
    return this.s.id;
  }

  get change(): UpkeepChange {
    return this.s.change;
  }

  get finding(): UpkeepFinding {
    return this.s.finding;
  }

  get memories(): readonly MemoryId[] {
    return this.s.memories;
  }

  get body(): MemoryBody | null {
    return this.s.body;
  }

  get reason(): string {
    return this.s.reason;
  }

  get state(): UpkeepProposalState {
    return this.s.state;
  }

  get decision(): MemoryDecision | null {
    return this.s.decision;
  }

  get pending(): boolean {
    return this.s.state === 'pending';
  }

  approve(decision: MemoryDecision): UpkeepProposal {
    this.assertPending();

    return new UpkeepProposal({ ...this.s, state: 'approved', decision });
  }

  reject(decision: MemoryDecision): UpkeepProposal {
    this.assertPending();

    return new UpkeepProposal({ ...this.s, state: 'rejected', decision });
  }

  lapse(): UpkeepProposal {
    if (this.s.state !== 'approved') {
      throw new InconsistentStateError(
        'memory upkeep proposal',
        `lapses only once approved, and is ${this.s.state}`,
      );
    }

    return new UpkeepProposal({ ...this.s, state: 'lapsed' });
  }

  private assertPending(): void {
    if (!this.pending) {
      throw new MemoryAlreadyDecidedError(this.s.id.value, this.s.state);
    }
  }
}
