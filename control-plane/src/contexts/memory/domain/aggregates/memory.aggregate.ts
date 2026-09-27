import { MemoryRetired } from '@memory/domain/events/memory-retired.event';
import { MemoryStood } from '@memory/domain/events/memory-stood.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyRetiredError } from '@memory/domain/exceptions/memory-already-retired.error';
import { memoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import {
  isMemoryKind,
  type MemoryKind,
} from '@memory/domain/value-objects/memory-kind';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import {
  MEMORY_SOURCES,
  type MemorySource,
} from '@memory/domain/value-objects/memory-source';
import type { MemoryStanding } from '@memory/domain/value-objects/memory-standing';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: MemoryId;
  readonly workspaceId: WorkspaceId;
  readonly kind: MemoryKind;
  readonly body: string;
  readonly scope: MemoryScope;
  readonly grounds: MemoryGrounds | null;
  readonly source: MemorySource;
  readonly supersedes: MemoryId | null;
  readonly approval: MemoryDecision;
  readonly retirement: MemoryRetirement | null;
  readonly version: number;
}

export class Memory extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static stood(input: {
    id: MemoryId;
    workspaceId: WorkspaceId;
    kind: string;
    body: string;
    scope: MemoryScope;
    grounds: MemoryGrounds;
    source: string;
    supersedes: MemoryId | null;
    approval: MemoryDecision;
  }): Memory {
    return Memory.standing(input);
  }

  static written(input: {
    id: MemoryId;
    workspaceId: WorkspaceId;
    kind: string;
    body: string;
    scope: MemoryScope;
    grounds: MemoryGrounds | null;
    supersedes: MemoryId | null;
    by: MemoryDecision;
  }): Memory {
    return Memory.standing({
      ...input,
      source: 'person',
      approval: input.by,
    });
  }

  private static standing(input: {
    id: MemoryId;
    workspaceId: WorkspaceId;
    kind: string;
    body: string;
    scope: MemoryScope;
    grounds: MemoryGrounds | null;
    source: string;
    supersedes: MemoryId | null;
    approval: MemoryDecision;
  }): Memory {
    const { kind, source } = input;

    if (!isMemoryKind(kind)) {
      throw new InvalidMemoryError(`is of a kind nobody knows (${kind})`);
    }

    const known = MEMORY_SOURCES.find((each) => each === source);

    if (!known) {
      throw new InvalidMemoryError(`comes from somewhere unknown (${source})`);
    }

    if (input.supersedes?.equals(input.id)) {
      throw new InvalidMemoryError('never supersedes itself');
    }

    const stood = new Memory({
      id: input.id,
      workspaceId: input.workspaceId,
      kind,
      body: memoryBody(input.body),
      scope: input.scope,
      grounds: input.grounds,
      source: known,
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

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get kind(): MemoryKind {
    return this.state.kind;
  }

  get body(): string {
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

  get version(): number {
    return this.state.version;
  }

  supersededBy(successor: MemoryId, at: Date): Memory {
    if (successor.equals(this.state.id)) {
      throw new InvalidMemoryError('is never superseded by itself');
    }

    return this.retiring(MemoryRetirement.superseded(successor, at));
  }

  correctedAs(input: {
    id: MemoryId;
    kind: string;
    body: string;
    scope: MemoryScope;
    by: MemoryDecision;
  }): { readonly retired: Memory; readonly successor: Memory } {
    if (this.state.retirement) {
      throw new MemoryAlreadyRetiredError(this.state.id.value);
    }

    const successor = Memory.written({
      ...input,
      workspaceId: this.state.workspaceId,
      grounds: this.state.grounds,
      supersedes: this.state.id,
    });

    return {
      retired: this.retiring(
        MemoryRetirement.superseded(input.id, input.by.at),
      ),
      successor,
    };
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
