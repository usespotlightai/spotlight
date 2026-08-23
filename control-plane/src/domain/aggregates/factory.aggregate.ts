import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** "Every factory has a line" is a provisioning rule, not an invariant here:
 *  the lines are their own aggregate, so this cannot enforce it. */
export class Factory {
  private constructor(
    readonly id: FactoryId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
  ) {}

  static open(input: {
    id: FactoryId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
  }): Factory {
    return new Factory(input.id, input.workspaceId, input.teamId);
  }

  equals(other: Factory): boolean {
    return this.id.equals(other.id);
  }
}
