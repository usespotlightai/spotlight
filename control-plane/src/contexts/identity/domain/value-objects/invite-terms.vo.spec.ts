import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

describe('InviteTerms', () => {
  it('names the role invited as', () => {
    expect(InviteTerms.of(WorkspaceRole.admin, []).invitedAs).toBe('admin');
    expect(InviteTerms.of(WorkspaceRole.member, []).invitedAs).toBe('member');
  });

  it('may name no team at all', () => {
    expect(InviteTerms.of(WorkspaceRole.member, []).teams).toEqual([]);
  });

  it('names each team once', () => {
    const terms = InviteTerms.of(WorkspaceRole.member, [
      TeamId.of('team_1'),
      TeamId.of('team_1'),
      TeamId.of('team_2'),
    ]);

    expect(terms.teams.map((each) => each.value)).toEqual(['team_1', 'team_2']);
    expect(terms.joins(TeamId.of('team_2'))).toBe(true);
    expect(terms.joins(TeamId.of('team_3'))).toBe(false);
  });

  it('does not offer to make an owner', () => {
    expect(() => InviteTerms.of(WorkspaceRole.owner, [])).toThrow(
      /offers to make an owner/,
    );
  });
});
