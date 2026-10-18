import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

describe('InviteSpec', () => {
  it('names the role invited as', () => {
    expect(InviteSpec.of(WorkspaceRole.admin, []).invitedAs).toBe('admin');
    expect(InviteSpec.of(WorkspaceRole.member, []).invitedAs).toBe('member');
  });

  it('may name no team at all', () => {
    expect(InviteSpec.of(WorkspaceRole.member, []).teams).toEqual([]);
  });

  it('names each team once', () => {
    const spec = InviteSpec.of(WorkspaceRole.member, [
      TeamId.of('team_1'),
      TeamId.of('team_1'),
      TeamId.of('team_2'),
    ]);

    expect(spec.teams.map((each) => each.value)).toEqual(['team_1', 'team_2']);
    expect(spec.joins(TeamId.of('team_2'))).toBe(true);
    expect(spec.joins(TeamId.of('team_3'))).toBe(false);
  });

  it('does not offer to make an owner', () => {
    expect(() => InviteSpec.of(WorkspaceRole.owner, [])).toThrow(
      /offers to make an owner/,
    );
  });
});
