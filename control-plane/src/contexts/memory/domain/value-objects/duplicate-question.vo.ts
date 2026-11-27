import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';

/** A memory as the check showed it to the model: its handle, what it said and where it applied then. */
export interface AskedMemory {
  readonly memory: MemoryId;
  readonly handle: MemoryHandle;
  readonly kind: MemoryKind;
  readonly body: string;
  readonly where: string;
}

/** A proposal as the check showed it to the model, under a ref the check gave it, with the memories it was compared with. */
export interface AskedProposal {
  readonly ref: string;
  readonly proposal: MemoryId;
  readonly kind: MemoryKind;
  readonly body: string;
  readonly where: string;
  readonly candidates: readonly MemoryId[];
}

const REF = /^P-[1-9]\d*$/;

const refOf = (at: number): string => `P-${at + 1}`;

/**
 * What a duplicate check asked the model, recorded once when its session is ordered. The session reads its question
 * only once, so every later look at the answer reads it against this record, never against the proposals and memories
 * as they stand by then.
 */
export class DuplicateQuestion {
  private constructor(
    readonly proposals: readonly AskedProposal[],
    readonly memories: readonly AskedMemory[],
  ) {}

  /** Asks about the proposals in this order, giving each the ref `P-1`, `P-2` and so on. */
  static asking(input: {
    proposals: readonly Omit<AskedProposal, 'ref'>[];
    memories: readonly AskedMemory[];
  }): DuplicateQuestion {
    return DuplicateQuestion.of({
      proposals: input.proposals.map((each, at) => ({
        ...each,
        ref: refOf(at),
      })),
      memories: input.memories,
    });
  }

  static of(input: {
    proposals: readonly AskedProposal[];
    memories: readonly AskedMemory[];
  }): DuplicateQuestion {
    const { proposals, memories } = input;

    if (proposals.length === 0) {
      throw new InvalidMemoryError('asks about a proposal', 'duplicate check');
    }

    if (
      proposals.some((each) => !REF.test(each.ref)) ||
      new Set(proposals.map((each) => each.ref)).size !== proposals.length ||
      new Set(proposals.map((each) => each.proposal.value)).size !==
        proposals.length
    ) {
      throw new InvalidMemoryError(
        'asks about each proposal once, under its own ref',
        'duplicate check',
      );
    }

    if (
      new Set(memories.map((each) => each.memory.value)).size !==
        memories.length ||
      new Set(memories.map((each) => each.handle.number)).size !==
        memories.length
    ) {
      throw new InvalidMemoryError('shows each memory once', 'duplicate check');
    }

    if (
      proposals.some(
        (each) =>
          each.candidates.length === 0 ||
          each.candidates.some(
            (id) => !memories.some((memory) => memory.memory.equals(id)),
          ),
      )
    ) {
      throw new InvalidMemoryError(
        'compares each proposal with memories it shows',
        'duplicate check',
      );
    }

    return new DuplicateQuestion(proposals, memories);
  }

  /** The proposal it asked about under the ref, or null. */
  proposalNamed(ref: string): AskedProposal | null {
    const wanted = ref.trim().toUpperCase();

    return this.proposals.find((each) => each.ref === wanted) ?? null;
  }

  /** The memory with the handle, when it was one the proposal was compared with; otherwise null. */
  candidateOf(asked: AskedProposal, handle: MemoryHandle): MemoryId | null {
    const memory = this.memories.find((each) => each.handle.equals(handle));

    return memory && asked.candidates.some((id) => id.equals(memory.memory))
      ? memory.memory
      : null;
  }

  /** Whether it compared the proposal with the memory. */
  compared(proposal: MemoryId, memory: MemoryId): boolean {
    return this.proposals.some(
      (each) =>
        each.proposal.equals(proposal) &&
        each.candidates.some((id) => id.equals(memory)),
    );
  }

  asked(proposal: MemoryId): boolean {
    return this.proposals.some((each) => each.proposal.equals(proposal));
  }
}
