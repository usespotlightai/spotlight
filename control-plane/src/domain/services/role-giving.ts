import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';

export type RefusalToGive =
  | 'not-a-member'
  | 'not-yours-to-give'
  | 'not-below-you'
  | 'your-own'
  | 'above-your-rank'
  | 'last-owner';

export interface Standing {
  readonly mine: WorkspaceRole | null;
  readonly theirs: WorkspaceRole | null;
  readonly lastOwner: boolean;
  readonly isSelf: boolean;
}

export function refusalToGive(
  standing: Standing,
  role: WorkspaceRole,
): RefusalToGive | null {
  const { mine, theirs } = standing;

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
    return standing.isSelf ? 'your-own' : 'not-below-you';
  }
  if (!mine.rankedAtLeast(role)) {
    return 'above-your-rank';
  }
  if (standing.lastOwner && !role.isOwner) {
    return 'last-owner';
  }

  return null;
}

export function rolesGivable(standing: Standing): readonly WorkspaceRole[] {
  if (!standing.theirs) {
    return [];
  }

  const givable = WorkspaceRole.all.filter(
    (role) => refusalToGive(standing, role) === null,
  );

  return givable.length > 1 ? givable : [];
}
