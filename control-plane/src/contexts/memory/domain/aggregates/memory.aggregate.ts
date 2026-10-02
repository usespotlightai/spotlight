import { MemoryRetired } from '@memory/domain/events/memory-retired.event';
import { MemoryStood } from '@memory/domain/events/memory-stood.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyRetiredError } from '@memory/domain/exceptions/memory-already-retired.error';
import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { MemorySource } from '@memory/domain/value-objects/memory-source';
import type { MemoryStanding } from '@memory/domain/value-objects/memory-standing';
import type { RunSite } from '@memory/domain/value-objects/run-site';
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
  readonly grounds: MemoryGrounds | null;
  readonly source: MemorySource;
  readonly supersedes: MemoryId | null;
  readonly approval: MemoryDecision;
  readonly retirement: MemoryRetirement | null;
  readonly version: number;
}

interface Standing {
  readonly id: MemoryId;
  readonly handle: MemoryHandle;
  readonly workspaceId: WorkspaceId;
  readonly kind: MemoryKind;
  readonly body: MemoryBody;
  readonly scope: MemoryScope;
  readonly grounds: MemoryGrounds | null;
  readonly source: MemorySource;
  readonly supersedes: MemoryId | null;
  readonly approval: MemoryDecision;
}

export class Memory extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static stood(input: {
    id: MemoryId;
    handle: MemoryHandle;
    workspaceId: WorkspaceId;
    kind: MemoryKind;
    body: MemoryBody;
    scope: MemoryScope;
    grounds: MemoryGrounds;
    source: MemorySource;
    supersedes: Memory | null;
    approval: MemoryDecision;
  }): Memory {
    const { supersedes } = input;

    return Memory.standing({
      ...input,
      supersedes: supersedes?.stands ? supersedes.id : null,
    });
  }

  static written(input: {
    id: MemoryId;
    handle: MemoryHandle;
    workspaceId: WorkspaceId;
    kind: MemoryKind;
    body: MemoryBody;
    scope: MemoryScope;
    grounds: MemoryGrounds | null;
    by: MemoryDecision;
  }): Memory {
    return Memory.standing({
      ...input,
      source: 'person',
      supersedes: null,
      approval: input.by,
    });
  }

  private static standing(input: Standing): Memory {
    if (input.supersedes?.equals(input.id)) {
      throw new InvalidMemoryError('never supersedes itself');
    }

    const stood = new Memory({
      id: input.id,
      handle: input.handle,
      workspaceId: input.workspaceId,
      kind: input.kind,
      body: input.body,
      scope: input.scope,
      grounds: input.grounds,
      source: input.source,
      supersedes: input.supersedes,
      approval: input.approval,
      retirement: null,
      version: 0,
    });
    stood.record(new MemoryStood(input.id, input.supersedes));
    return stood;
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

  get grounds(): MemoryGrounds | null {
    return this.state.grounds;
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

  get standing(): MemoryStanding {
    return this.state.retirement ? 'retired' : 'stands';
  }

  get stands(): boolean {
    return this.state.retirement === null;
  }

  get version(): number {
    return this.state.version;
  }

  standsOn(teamId: TeamId): boolean {
    return this.stands && this.isTeams(teamId);
  }

  isTeams(teamId: TeamId): boolean {
    return this.state.scope.teamId.equals(teamId);
  }

  stoodAt(at: Date): boolean {
    const retired = this.state.retirement?.at ?? null;

    return (
      this.state.approval.at.getTime() <= at.getTime() &&
      (retired === null || retired.getTime() > at.getTime())
    );
  }

  stoodOn(teamId: TeamId, at: Date): boolean {
    return this.isTeams(teamId) && this.stoodAt(at);
  }

  appliesAt(site: RunSite): boolean {
    return this.stands && this.state.scope.appliesAt(site);
  }

  supersededBy(successor: MemoryId, at: Date): Memory {
    if (successor.equals(this.state.id)) {
      throw new InvalidMemoryError('is never superseded by itself');
    }

    return this.retiring(MemoryRetirement.superseded(successor, at));
  }

  correctedAs(input: {
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

    return Memory.standing({
      ...input,
      workspaceId: this.state.workspaceId,
      grounds: this.state.grounds,
      source: 'person',
      supersedes: this.state.id,
      approval: input.by,
    });
  }

  retired(input: { by: UserId; reason: string; at: Date }): Memory {
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
    retired.record(new MemoryRetired(this.state.id, retirement.supersededBy));
    return retired;
  }
}
