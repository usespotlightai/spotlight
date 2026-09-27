import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import { memoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
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
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MEMORY_PROPOSAL_STATES = [
  'proposed',
  'approved',
  'rejected',
] as const;

export type MemoryProposalState = (typeof MEMORY_PROPOSAL_STATES)[number];

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
    readonly decision: MemoryDecision | null,
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

    if (input.supersedes?.equals(input.id)) {
      throw new InvalidMemoryError('never supersedes itself');
    }

    return new MemoryProposal(
      input.id,
      input.kind,
      memoryBody(input.body),
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
    decision: MemoryDecision | null;
  }): MemoryProposal {
    if ((input.state === 'proposed') !== (input.decision === null)) {
      throw new InconsistentStateError(
        'memory proposal',
        'is decided without saying who decided it and when, or says so while still proposed',
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
      input.decision,
    );
  }

  get proposed(): boolean {
    return this.state === 'proposed';
  }

  get fromOutside(): boolean {
    return this.source === 'outside';
  }

  proposedIn(runId: RunId): boolean {
    return this.proposed && this.grounds.runId.equals(runId);
  }

  citesNote(position: number): boolean {
    return this.grounds.notes.includes(position);
  }

  approved(decision: MemoryDecision, body?: string): MemoryProposal {
    return this.decided(
      'approved',
      decision,
      body === undefined ? this.body : memoryBody(body),
    );
  }

  rejected(decision: MemoryDecision): MemoryProposal {
    return this.decided('rejected', decision, this.body);
  }

  private decided(
    state: MemoryProposalState,
    decision: MemoryDecision,
    body: string,
  ): MemoryProposal {
    if (!this.proposed) {
      throw new MemoryAlreadyDecidedError(this.id.value, this.state);
    }

    return new MemoryProposal(
      this.id,
      this.kind,
      body,
      this.scope,
      this.grounds,
      this.source,
      this.supersedes,
      this.recordedAt,
      state,
      decision,
    );
  }
}
