import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import {
  isMemoryKind,
  MEMORY_KINDS,
  type MemoryKind,
} from '@memory/domain/value-objects/memory-kind';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { MemorySource } from '@memory/domain/value-objects/memory-source';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const MEMORY_PROPOSAL_STATES = ['proposed', 'rejected'] as const;

export type MemoryProposalState = (typeof MEMORY_PROPOSAL_STATES)[number];

const MOST_BODY = 1_000;

export interface ProposedMemory {
  readonly kind: string;
  readonly body: string;
  readonly reach: string;
  readonly repository: string | null;
  readonly paths: readonly string[];
  readonly steps: readonly number[];
  readonly notes: readonly number[];
  readonly supersedes: string | null;
}

export class MemoryProposal {
  private constructor(
    readonly id: MemoryId,
    readonly kind: MemoryKind,
    readonly body: string,
    readonly scope: MemoryScope,
    readonly grounds: MemoryGrounds,
    readonly source: MemorySource,
    readonly supersedes: MemoryId | null,
    readonly recordedAt: Date,
    readonly state: MemoryProposalState,
    readonly rejectedAt: Date | null,
  ) {}

  static of(input: {
    id: MemoryId;
    kind: string;
    body: string;
    scope: MemoryScope;
    grounds: MemoryGrounds;
    source: MemorySource;
    supersedes: MemoryId | null;
    recordedAt: Date;
  }): MemoryProposal {
    if (!isMemoryKind(input.kind)) {
      throw new InvalidMemoryError(
        `is one of ${MEMORY_KINDS.join(', ')}, not ${input.kind}`,
      );
    }

    const body = input.body.trim();

    if (!body || body.length > MOST_BODY) {
      throw new InvalidMemoryError(
        `says what is remembered in at most ${MOST_BODY} characters`,
      );
    }

    if (input.supersedes?.equals(input.id)) {
      throw new InvalidMemoryError('never supersedes itself');
    }

    return new MemoryProposal(
      input.id,
      input.kind,
      body,
      input.scope,
      input.grounds,
      input.source,
      input.supersedes,
      input.recordedAt,
      'proposed',
      null,
    );
  }

  static rehydrate(input: {
    id: MemoryId;
    kind: MemoryKind;
    body: string;
    scope: MemoryScope;
    grounds: MemoryGrounds;
    source: MemorySource;
    supersedes: MemoryId | null;
    recordedAt: Date;
    state: MemoryProposalState;
    rejectedAt: Date | null;
  }): MemoryProposal {
    if ((input.state === 'rejected') !== (input.rejectedAt !== null)) {
      throw new InconsistentStateError(
        'memory proposal',
        'is rejected without saying when, or says when while still proposed',
      );
    }

    return new MemoryProposal(
      input.id,
      input.kind,
      input.body,
      input.scope,
      input.grounds,
      input.source,
      input.supersedes,
      input.recordedAt,
      input.state,
      input.rejectedAt,
    );
  }

  get proposed(): boolean {
    return this.state === 'proposed';
  }

  citesNote(position: number): boolean {
    return this.grounds.notes.includes(position);
  }
}
