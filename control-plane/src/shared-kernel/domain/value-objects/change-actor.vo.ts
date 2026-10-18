import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ChangeActor {
  private constructor(
    readonly actor: Actor | null,
    readonly workspaceId: WorkspaceId,
  ) {}

  static of(actor: Actor, workspaceId: WorkspaceId): ChangeActor {
    return new ChangeActor(actor, workspaceId);
  }

  static spotlight(workspaceId: WorkspaceId): ChangeActor {
    return new ChangeActor(null, workspaceId);
  }
}
