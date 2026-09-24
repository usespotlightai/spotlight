import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Attribution {
  private constructor(
    readonly actor: Actor | null,
    readonly workspaceId: WorkspaceId,
  ) {}

  static of(actor: Actor, workspaceId: WorkspaceId): Attribution {
    return new Attribution(actor, workspaceId);
  }

  static spotlight(workspaceId: WorkspaceId): Attribution {
    return new Attribution(null, workspaceId);
  }
}
