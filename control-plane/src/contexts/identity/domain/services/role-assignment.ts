import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';

export type RoleAssignmentDenial =
  | 'not-a-member'
  | 'not-an-admin'
  | 'not-below-you'
  | 'your-own'
  | 'above-your-rank'
  | 'last-owner';

export interface RoleAssignmentContext {
  readonly callerRole: WorkspaceRole | null;
  readonly memberRole: WorkspaceRole | null;
  readonly isLastOwner: boolean;
  readonly isSelf: boolean;
}

export function roleAssignmentDenial(
  context: RoleAssignmentContext,
  role: WorkspaceRole,
): RoleAssignmentDenial | null {
  const { callerRole, memberRole } = context;

  if (!memberRole) {
    return 'not-a-member';
  }
  if (!callerRole?.rankedAtLeast(WorkspaceRole.admin)) {
    return 'not-an-admin';
  }

  if (memberRole.equals(role)) {
    return null;
  }

  if (!(callerRole.isOwner || callerRole.outranks(memberRole))) {
    return context.isSelf ? 'your-own' : 'not-below-you';
  }
  if (!callerRole.rankedAtLeast(role)) {
    return 'above-your-rank';
  }
  if (context.isLastOwner && !role.isOwner) {
    return 'last-owner';
  }

  return null;
}

export function assignableRoles(
  context: RoleAssignmentContext,
): readonly WorkspaceRole[] {
  if (!context.memberRole) {
    return [];
  }

  const assignable = WorkspaceRole.all.filter(
    (role) => roleAssignmentDenial(context, role) === null,
  );

  return assignable.length > 1 ? assignable : [];
}
