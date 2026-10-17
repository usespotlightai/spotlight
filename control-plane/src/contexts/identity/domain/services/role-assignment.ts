import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';

export type RoleAssignmentDenial =
  | 'not-a-member'
  | 'not-an-admin'
  | 'not-below-you'
  | 'your-own'
  | 'above-your-rank'
  | 'last-owner';

export interface RolePositions {
  readonly mine: WorkspaceRole | null;
  readonly theirs: WorkspaceRole | null;
  readonly lastOwner: boolean;
  readonly isSelf: boolean;
}

export function roleAssignmentDenial(
  positions: RolePositions,
  role: WorkspaceRole,
): RoleAssignmentDenial | null {
  const { mine, theirs } = positions;

  if (!theirs) {
    return 'not-a-member';
  }
  if (!mine?.rankedAtLeast(WorkspaceRole.admin)) {
    return 'not-an-admin';
  }

  if (theirs.equals(role)) {
    return null;
  }

  if (!(mine.isOwner || mine.outranks(theirs))) {
    return positions.isSelf ? 'your-own' : 'not-below-you';
  }
  if (!mine.rankedAtLeast(role)) {
    return 'above-your-rank';
  }
  if (positions.lastOwner && !role.isOwner) {
    return 'last-owner';
  }

  return null;
}

export function assignableRoles(
  positions: RolePositions,
): readonly WorkspaceRole[] {
  if (!positions.theirs) {
    return [];
  }

  const assignable = WorkspaceRole.all.filter(
    (role) => roleAssignmentDenial(positions, role) === null,
  );

  return assignable.length > 1 ? assignable : [];
}
