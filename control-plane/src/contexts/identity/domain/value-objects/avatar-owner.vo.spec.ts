import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');

describe('AvatarOwner', () => {
  it('tells a workspace from a team in the same workspace', () => {
    const workspace = AvatarOwner.workspace(WORKSPACE);
    const team = AvatarOwner.team(WORKSPACE, TEAM);

    expect(workspace.isTeam).toBe(false);
    expect(team.isTeam).toBe(true);
    expect(workspace.equals(team)).toBe(false);
    expect(team.equals(AvatarOwner.team(WORKSPACE, TEAM))).toBe(true);
  });

  it('names itself', () => {
    expect(AvatarOwner.workspace(WORKSPACE).toString()).toBe('workspace ws_1');
    expect(AvatarOwner.team(WORKSPACE, TEAM).toString()).toBe('team team_1');
  });
});
