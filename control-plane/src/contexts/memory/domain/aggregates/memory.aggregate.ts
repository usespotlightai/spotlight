import { MemoryCreated } from '@memory/domain/events/memory-created.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyRetiredError } from '@memory/domain/exceptions/memory-already-retired.error';
import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPredecessor } from '@memory/domain/value-objects/memory-predecessor.vo';
import type { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { MemorySource } from '@memory/domain/value-objects/memory-source';
import type { MemoryStatus } from '@memory/domain/value-objects/memory-status';
import type { RunContext } from '@memory/domain/value-objects/run-context';
import { type Erased, erasedAs } from '@shared-kernel/domain/erased';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: MemoryId;
  readonly handle: MemoryHandle;
  readonly workspaceId: WorkspaceId;
  readonly kind: MemoryKind;
  readonly body: MemoryBody;
  readonly scope: MemoryScope;
  readonly provenance: MemoryProvenance | null;
  readonly source: MemorySource;
  readonly supersedes: MemoryId | null;
  readonly approval: MemoryDecision;
  readonly retirement: MemoryRetirement | null;
  readonly version: number;
}

interface NewMemory {
  readonly id: MemoryId;
  readonly handle: MemoryHandle;
  readonly workspaceId: WorkspaceId;
  readonly kind: MemoryKind;
  readonly body: MemoryBody;
  readonly scope: MemoryScope;
  readonly provenance: MemoryProvenance | null;
  readonly source: MemorySource;
  readonly supersedes: MemoryId | null;
  readonly approval: MemoryDecision;
}

export class Memory extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(input: {
    id: MemoryId;
    handle: MemoryHandle;
    workspaceId: WorkspaceId;
    kind: MemoryKind;
    body: MemoryBody;
    scope: MemoryScope;
    provenance: MemoryProvenance;
    source: MemorySource;
    supersedes: MemoryPredecessor | null;
    approval: MemoryDecision;
  }): Memory {
    const { supersedes } = input;

    return Memory.make({
      ...input,
      supersedes: supersedes?.supersedableIn(input.scope.teamId)
        ? supersedes.id
        : null,
    });
  }

  static write(input: {
    id: MemoryId;
    handle: MemoryHandle;
    workspaceId: WorkspaceId;
    kind: MemoryKind;
    body: MemoryBody;
    scope: MemoryScope;
    provenance: MemoryProvenance | null;
    by: MemoryDecision;
  }): Memory {
    return Memory.make({
      ...input,
      source: 'person',
      supersedes: null,
      approval: input.by,
    });
  }

  private static make(input: NewMemory): Memory {
    if (input.supersedes?.equals(input.id)) {
      throw new InvalidMemoryError('cannot supersede itself');
    }

    const created = new Memory({
      id: input.id,
      handle: input.handle,
      workspaceId: input.workspaceId,
      kind: input.kind,
      body: input.body,
      scope: input.scope,
      provenance: input.provenance,
      source: input.source,
      supersedes: input.supersedes,
      approval: input.approval,
      retirement: null,
      version: 0,
    });
    created.record(new MemoryCreated(input.id, input.supersedes));
    return created;
  }

  static rehydrate(state: State): Memory {
    if (state.retirement && state.retirement.at < state.approval.at) {
      throw new InconsistentStateError(
        'memory',
        'was retired before it was approved',
      );
    }

    return new Memory(state);
  }

  get id(): MemoryId {
    return this.state.id;
  }

  get handle(): MemoryHandle {
    return this.state.handle;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get kind(): MemoryKind {
    return this.state.kind;
  }

  get body(): MemoryBody {
    return this.state.body;
  }

  get scope(): MemoryScope {
    return this.state.scope;
  }

  get provenance(): MemoryProvenance | null {
    return this.state.provenance;
  }

  get source(): MemorySource {
    return this.state.source;
  }

  get supersedes(): MemoryId | null {
    return this.state.supersedes;
  }

  get approval(): MemoryDecision {
    return this.state.approval;
  }

  get retirement(): MemoryRetirement | null {
    return this.state.retirement;
  }

  get status(): MemoryStatus {
    return this.state.retirement ? 'retired' : 'active';
  }

  get isActive(): boolean {
    return this.state.retirement === null;
  }

  get version(): number {
    return this.state.version;
  }

  get asPredecessor(): MemoryPredecessor {
    return MemoryPredecessor.of({
      id: this.state.id,
      handle: this.state.handle,
      teamId: this.state.scope.teamId,
      active: this.isActive,
    });
  }

  isTeams(teamId: TeamId): boolean {
    return this.state.scope.teamId.equals(teamId);
  }

  activeAt(at: Date): boolean {
    const retired = this.state.retirement?.at ?? null;

    return (
      this.state.approval.at.getTime() <= at.getTime() &&
      (retired === null || retired.getTime() > at.getTime())
    );
  }

  activeAsOf(asOf: Date | null): boolean {
    return asOf ? this.activeAt(asOf) : this.isActive;
  }

  activeOn(teamId: TeamId, asOf: Date | null): boolean {
    return this.isTeams(teamId) && this.activeAsOf(asOf);
  }

  appliesAt(runContext: RunContext, asOf: Date | null): boolean {
    return this.activeAsOf(asOf) && this.state.scope.appliesAt(runContext);
  }

  supersedeWith(successor: MemoryId, at: Date): Memory {
    if (successor.equals(this.state.id)) {
      throw new InvalidMemoryError('cannot supersede itself');
    }

    return this.retiring(MemoryRetirement.superseded(successor, at));
  }

  correct(input: {
    id: MemoryId;
    handle: MemoryHandle;
    kind: MemoryKind;
    body: MemoryBody;
    scope: MemoryScope;
    by: MemoryDecision;
  }): Memory {
    if (this.state.retirement) {
      throw new MemoryAlreadyRetiredError(this.state.id.value);
    }

    return Memory.make({
      ...input,
      workspaceId: this.state.workspaceId,
      provenance: this.state.provenance,
      source: 'person',
      supersedes: this.state.id,
      approval: input.by,
    });
  }

  afterPredecessor(predecessor: Memory | null): Memory {
    if (
      !this.state.supersedes ||
      predecessor?.isActive ||
      predecessor?.retirement?.supersededBy?.equals(this.state.id)
    ) {
      return this;
    }

    const alone = new Memory({ ...this.state, supersedes: null });
    alone.inheritEvents(this);
    return alone;
  }

  retire(input: { by: UserId; reason: string; at: Date }): Memory {
    if (this.state.retirement) {
      throw new MemoryAlreadyRetiredError(this.state.id.value);
    }

    return this.retiring(MemoryRetirement.retired(input));
  }

  private retiring(retirement: MemoryRetirement): Memory {
    if (this.state.retirement) {
      return this;
    }

    const retired = new Memory({ ...this.state, retirement });
    retired.inheritEvents(this);
    return retired;
  }

  erased(): Erased<Memory> {
    return erasedAs(this);
  }
}
