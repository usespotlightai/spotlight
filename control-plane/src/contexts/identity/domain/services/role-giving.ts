import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';

export type RoleAssignmentDenial =
  | 'not-a-member'
  | 'not-yours-to-give'
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
    return 'not-yours-to-give';
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

export function rolesGivable(
  positions: RolePositions,
): readonly WorkspaceRole[] {
  if (!positions.theirs) {
    return [];
  }

  const givable = WorkspaceRole.all.filter(
    (role) => roleAssignmentDenial(positions, role) === null,
  );

  return givable.length > 1 ? givable : [];
}
