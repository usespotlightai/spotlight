import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class TeamCreated {
  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
  ) {}
}
