import type {
  RoleAssignmentContext,
  RoleAssignmentDenial,
} from '@identity/domain/services/role-assignment';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';

export function suspensionDenial(
  context: RoleAssignmentContext,
): RoleAssignmentDenial | null {
  const { callerRole, memberRole } = context;

  if (!memberRole) {
    return 'not-a-member';
  }
  if (callerRole?.rankedAtLeast(WorkspaceRole.admin) !== true) {
    return 'not-an-admin-to-suspend';
  }
  if (memberRole.isOwner && !callerRole.isOwner) {
    return 'suspend-above-your-rank';
  }
  if (context.isLastOwner) {
    return 'last-owner';
  }
  if (context.isSelf) {
    return 'suspend-your-own';
  }

  return null;
}

export function leaveDenial(
  context: RoleAssignmentContext,
): RoleAssignmentDenial | null {
  if (!context.memberRole) {
    return 'not-a-member';
  }

  return context.isLastOwner ? 'last-owner' : null;
}
