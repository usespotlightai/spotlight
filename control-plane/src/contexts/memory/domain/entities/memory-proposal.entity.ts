import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import { inactiveOf } from '@memory/domain/services/memory-lapse';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { MemorySource } from '@memory/domain/value-objects/memory-source';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MEMORY_PROPOSAL_STATES = [
  'proposed',
  'approved',
  'rejected',
  'lapsed',
] as const;

export type MemoryProposalState = (typeof MEMORY_PROPOSAL_STATES)[number];

const MAX_REASON = 500;

const reasonOf = (raw: string): string => {
  const reason = raw.trim();

  if (!reason || reason.length > MAX_REASON) {
    throw new InvalidMemoryError(
      `says why to retire a memory in at most ${MAX_REASON} characters`,
    );
  }

  return reason;
};

export interface Retiring {
  readonly memory: MemoryId;
  readonly reason: string;
}

export class MemoryProposal {
  private constructor(
    readonly id: MemoryId,
    readonly kind: MemoryKind,
    readonly body: MemoryBody,
    readonly scope: MemoryScope,
    readonly provenance: MemoryProvenance,
    readonly source: MemorySource,
    readonly supersedes: MemoryId | null,
    readonly retires: Retiring | null,
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
      input.supersedes,
      null,
      input.recordedAt,
      'proposed',
      null,
    );
  }

  static retiring(input: {
    id: MemoryId;
    retired: {
      readonly id: MemoryId;
      readonly kind: MemoryKind;
      readonly body: MemoryBody;
      readonly scope: MemoryScope;
    };
    reason: string;
    provenance: MemoryProvenance;
    source: MemorySource;
    recordedAt: Date;
  }): MemoryProposal {
    if (input.retired.id.equals(input.id)) {
      throw new InvalidMemoryError('cannot retire itself');
    }

    return new MemoryProposal(
      input.id,
      input.retired.kind,
      input.retired.body,
      input.retired.scope,
      input.provenance,
      input.source,
      null,
      { memory: input.retired.id, reason: reasonOf(input.reason) },
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
    supersedes: MemoryId | null;
    retires: Retiring | null;
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

    if (input.state === 'lapsed' && !input.retires) {
      throw new InconsistentStateError(
        'memory proposal',
        'lapsed without retiring a memory',
      );
    }

    if (input.retires && input.supersedes) {
      throw new InconsistentStateError(
        'memory proposal',
        'both retires a memory and supersedes one',
      );
    }

    return new MemoryProposal(
      input.id,
      input.kind,
      input.body,
      input.scope,
      input.provenance,
      input.source,
      input.supersedes,
      input.retires,
      input.recordedAt,
      input.state,
      input.decision,
    );
  }

  get proposed(): boolean {
    return this.state === 'proposed';
  }

  get editable(): boolean {
    return this.proposed && !this.retires;
  }

  inactiveIn(current: readonly Memory[]): readonly string[] {
    return this.retires
      ? inactiveOf([this.retires.memory], current, this.scope.teamId)
      : [];
  }

  get comparable(): boolean {
    return this.proposed && !this.retires;
  }

  get fromOutside(): boolean {
    return this.source === 'outside';
  }

  proposedIn(runId: RunId): boolean {
    return this.proposed && this.provenance.runId.equals(runId);
  }

  matches(other: MemoryProposal): boolean {
    if (this.retires || other.retires) {
      return Boolean(
        this.retires &&
        other.retires &&
        this.retires.memory.equals(other.retires.memory),
      );
    }

    return this.kind === other.kind && this.body.equals(other.body);
  }

  approve(decision: MemoryDecision, body?: string): MemoryProposal {
    if (this.retires && body !== undefined && body !== this.body.value) {
      throw new InvalidMemoryError(
        'is approved as it stands when it retires a memory',
      );
    }

    return this.decided(
      'approved',
      decision,
      body === undefined ? this.body : MemoryBody.of(body),
    );
  }

  reject(decision: MemoryDecision): MemoryProposal {
    return this.decided('rejected', decision, this.body);
  }

  lapse(): MemoryProposal {
    if (this.state !== 'approved' || !this.retires || !this.decision) {
      throw new InconsistentStateError(
        'memory proposal',
        'lapses only an approved retirement',
      );
    }

    return new MemoryProposal(
      this.id,
      this.kind,
      this.body,
      this.scope,
      this.provenance,
      this.source,
      this.supersedes,
      this.retires,
      this.recordedAt,
      'lapsed',
      this.decision,
    );
  }

  restore(): MemoryProposal {
    if (this.state !== 'rejected') {
      throw new MemoryAlreadyDecidedError(this.id.value, this.state);
    }

    return new MemoryProposal(
      this.id,
      this.kind,
      this.body,
      this.scope,
      this.provenance,
      this.source,
      this.supersedes,
      this.retires,
      this.recordedAt,
      'proposed',
      null,
    );
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
      this.supersedes,
      this.retires,
      this.recordedAt,
      state,
      decision,
    );
  }
}
