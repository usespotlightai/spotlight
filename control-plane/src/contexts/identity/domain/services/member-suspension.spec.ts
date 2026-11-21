import {
  leaveDenial,
  suspensionDenial,
} from '@identity/domain/services/member-suspension';
import type { RoleAssignmentContext } from '@identity/domain/services/role-assignment';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { describe, expect, it } from 'vitest';

const ROLES = [WorkspaceRole.owner, WorkspaceRole.admin, WorkspaceRole.member];

const context = (
  over: Partial<RoleAssignmentContext> = {},
): RoleAssignmentContext => ({
  callerRole: WorkspaceRole.owner,
  memberRole: WorkspaceRole.member,
  isLastOwner: false,
  isSelf: false,
  ...over,
});

describe('suspensionDenial', () => {
  it.each([
    ['owner', 'owner', null],
    ['owner', 'admin', null],
    ['owner', 'member', null],
    ['admin', 'owner', 'suspend-above-your-rank'],
    ['admin', 'admin', null],
    ['admin', 'member', null],
    ['member', 'owner', 'not-an-admin-to-suspend'],
    ['member', 'admin', 'not-an-admin-to-suspend'],
    ['member', 'member', 'not-an-admin-to-suspend'],
  ] as const)('gives %s on %s: %s', (caller, member, denial) => {
    expect(
      suspensionDenial(
        context({
          callerRole: WorkspaceRole.of(caller),
          memberRole: WorkspaceRole.of(member),
        }),
      ),
    ).toBe(denial);
  });

  it('names nobody who is not of the workspace', () => {
    expect(suspensionDenial(context({ memberRole: null }))).toBe(
      'not-a-member',
    );
  });

  it('denies a caller who is not of the workspace', () => {
    expect(suspensionDenial(context({ callerRole: null }))).toBe(
      'not-an-admin-to-suspend',
    );
  });

  it('denies suspending oneself, whatever the role', () => {
    for (const role of ROLES) {
      expect(
        suspensionDenial(
          context({ callerRole: role, memberRole: role, isSelf: true }),
        ),
      ).not.toBeNull();
    }
  });

  it('keeps the last owner, even from themselves', () => {
    expect(
      suspensionDenial(
        context({
          memberRole: WorkspaceRole.owner,
          isLastOwner: true,
          isSelf: true,
        }),
      ),
    ).toBe('last-owner');
  });
});

describe('leaveDenial', () => {
  it('lets anybody of the workspace go', () => {
    for (const role of ROLES) {
      expect(leaveDenial(context({ memberRole: role }))).toBeNull();
    }
  });

  it('keeps the last owner', () => {
    expect(
      leaveDenial(
        context({ memberRole: WorkspaceRole.owner, isLastOwner: true }),
      ),
    ).toBe('last-owner');
  });

  it('names nobody who is not of the workspace', () => {
    expect(leaveDenial(context({ memberRole: null }))).toBe('not-a-member');
  });
});
