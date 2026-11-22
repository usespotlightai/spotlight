import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import { MemoryUpkeepSettled } from '@memory/domain/events/memory-upkeep-settled.event';
import { MemoryUpkeepSwept } from '@memory/domain/events/memory-upkeep-swept.event';
import { UpkeepProposalApproved } from '@memory/domain/events/upkeep-proposal-approved.event';
import { UnknownUpkeepError } from '@memory/domain/exceptions/unknown-upkeep.error';
import { UpkeepProposalLapsedError } from '@memory/domain/exceptions/upkeep-proposal-lapsed.error';
import { inactiveOf } from '@memory/domain/services/memory-lapse';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface UpkeepFields {
  readonly id: MemoryUpkeepId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly sweptAt: Date;
  readonly proposals: readonly UpkeepProposal[];
  readonly version: number;
}

export class MemoryUpkeep extends EventRecorder {
  private constructor(private readonly s: UpkeepFields) {
    super();
  }

  static swept(input: Omit<UpkeepFields, 'version'>): MemoryUpkeep | null {
    if (input.proposals.length === 0) {
      return null;
    }

    const upkeep = MemoryUpkeep.rehydrate({ ...input, version: 0 });
    const counted = (change: UpkeepProposal['change']) =>
      input.proposals.filter((each) => each.change === change).length;

    upkeep.record(
      new MemoryUpkeepSwept(
        input.id,
        input.workspaceId,
        input.teamId,
        counted('retire'),
        counted('merge'),
      ),
    );

    return upkeep;
  }

  static rehydrate(fields: UpkeepFields): MemoryUpkeep {
    if (fields.version < 0) {
      throw new InconsistentStateError(
        'memory upkeep',
        'has a negative version',
      );
    }
    if (fields.proposals.length === 0) {
      throw new InconsistentStateError('memory upkeep', 'proposes nothing');
    }
    if (
      new Set(fields.proposals.map((each) => each.id.value)).size !==
      fields.proposals.length
    ) {
      throw new InconsistentStateError(
        'memory upkeep',
        'has two proposals with the same id',
      );
    }

    return new MemoryUpkeep(fields);
  }

  get id(): MemoryUpkeepId {
    return this.s.id;
  }

  get workspaceId(): WorkspaceId {
    return this.s.workspaceId;
  }

  get teamId(): TeamId {
    return this.s.teamId;
  }

  get sweptAt(): Date {
    return this.s.sweptAt;
  }

  get proposals(): readonly UpkeepProposal[] {
    return this.s.proposals;
  }

  get version(): number {
    return this.s.version;
  }

  get awaitsDecision(): boolean {
    return this.s.proposals.some((each) => each.pending);
  }

  proposal(id: UpkeepProposalId): UpkeepProposal {
    const found = this.s.proposals.find((each) => each.id.equals(id));

    if (!found) {
      throw new UnknownUpkeepError(`${this.s.id.value} proposal ${id.value}`);
    }

    return found;
  }

  approve(input: {
    proposalId: UpkeepProposalId;
    decision: MemoryDecision;
    newMemoryId: () => MemoryId;
    current: readonly Memory[];
  }): MemoryUpkeep {
    const proposal = this.proposal(input.proposalId);
    const lapsed = inactiveOf(proposal.memories, input.current, this.s.teamId);

    if (lapsed.length > 0) {
      throw new UpkeepProposalLapsedError(lapsed);
    }
    const approved = proposal.approve(input.decision);
    const next = this.replaced(approved);

    next.record(
      new UpkeepProposalApproved(
        this.s.id,
        this.s.workspaceId,
        this.s.teamId,
        approved.id,
        approved.change,
        approved.memories,
        approved.body,
        approved.reason,
        input.decision,
        approved.change === 'merge' ? input.newMemoryId() : null,
      ),
    );

    return next;
  }

  reject(proposalId: UpkeepProposalId, decision: MemoryDecision): MemoryUpkeep {
    return this.replaced(this.proposal(proposalId).reject(decision));
  }

  lapse(proposalId: UpkeepProposalId): MemoryUpkeep {
    return this.replaced(this.proposal(proposalId).lapse());
  }

  private replaced(changed: UpkeepProposal): MemoryUpkeep {
    const next = new MemoryUpkeep({
      ...this.s,
      proposals: this.s.proposals.map((each) =>
        each.id.equals(changed.id) ? changed : each,
      ),
    });
    next.inheritEvents(this);

    if (this.awaitsDecision && !next.awaitsDecision) {
      next.record(new MemoryUpkeepSettled(this.s.id, this.s.teamId));
    }

    return next;
  }
}
