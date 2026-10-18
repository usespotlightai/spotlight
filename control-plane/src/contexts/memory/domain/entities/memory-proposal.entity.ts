import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { MemoryProposer } from '@memory/domain/value-objects/memory-proposer';
import type { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
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
  readonly scope: string;
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
    readonly body: MemoryBody,
    readonly scope: MemoryScope,
    readonly provenance: MemoryProvenance,
    readonly source: MemorySource,
    readonly proposedBy: MemoryProposer,
    readonly supersedes: MemoryId | null,
    readonly recordedAt: Date,
    readonly state: MemoryProposalState,
    readonly decision: MemoryDecision | null,
  ) {}

  static of(input: {
    id: MemoryId;
    kind: MemoryKind;
    body: MemoryBody;
    scope: MemoryScope;
    provenance: MemoryProvenance;
    source: MemorySource;
    proposedBy: MemoryProposer;
    supersedes: MemoryId | null;
    recordedAt: Date;
  }): MemoryProposal {
    if (input.supersedes?.equals(input.id)) {
      throw new InvalidMemoryError('cannot supersede itself');
    }

    return new MemoryProposal(
      input.id,
      input.kind,
      input.body,
      input.scope,
      input.provenance,
      input.source,
      input.proposedBy,
      input.supersedes,
      input.recordedAt,
      'proposed',
      null,
    );
  }

  static rehydrate(input: {
    id: MemoryId;
    kind: MemoryKind;
    body: MemoryBody;
    scope: MemoryScope;
    provenance: MemoryProvenance;
    source: MemorySource;
    proposedBy: MemoryProposer;
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
      input.provenance,
      input.source,
      input.proposedBy,
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

  get remembered(): boolean {
    return this.proposedBy === 'agent';
  }

  proposedIn(runId: RunId): boolean {
    return this.proposed && this.provenance.runId.equals(runId);
  }

  citesNote(position: number): boolean {
    return this.provenance.notes.includes(position);
  }

  matches(other: MemoryProposal): boolean {
    return this.kind === other.kind && this.body.equals(other.body);
  }

  approve(decision: MemoryDecision, body?: string): MemoryProposal {
    return this.decided(
      'approved',
      decision,
      body === undefined ? this.body : MemoryBody.of(body),
    );
  }

  reject(decision: MemoryDecision): MemoryProposal {
    return this.decided('rejected', decision, this.body);
  }

  private decided(
    state: MemoryProposalState,
    decision: MemoryDecision,
    body: MemoryBody,
  ): MemoryProposal {
    if (!this.proposed) {
      throw new MemoryAlreadyDecidedError(this.id.value, this.state);
    }

    return new MemoryProposal(
      this.id,
      this.kind,
      body,
      this.scope,
      this.provenance,
      this.source,
      this.proposedBy,
      this.supersedes,
      this.recordedAt,
      state,
      decision,
    );
  }
}
