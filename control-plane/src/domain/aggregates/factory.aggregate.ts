import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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

  static of(input: {
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
