import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class AvatarOwner {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId | null,
  ) {}

  static workspace(workspaceId: WorkspaceId): AvatarOwner {
    return new AvatarOwner(workspaceId, null);
  }

  static team(workspaceId: WorkspaceId, teamId: TeamId): AvatarOwner {
    return new AvatarOwner(workspaceId, teamId);
  }

  get isTeam(): boolean {
    return this.teamId !== null;
  }

  equals(other: AvatarOwner): boolean {
    return (
      this.workspaceId.equals(other.workspaceId) &&
      (this.teamId === null
        ? other.teamId === null
        : other.teamId !== null && this.teamId.equals(other.teamId))
    );
  }

  toString(): string {
    return this.teamId
      ? `team ${this.teamId.value}`
      : `workspace ${this.workspaceId.value}`;
  }
}
