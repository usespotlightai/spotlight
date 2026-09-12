import { InvalidWorkspaceRoleError } from '@domain/exceptions/invalid-workspace-role.error';

export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;

export type WorkspaceRoleName = (typeof WORKSPACE_ROLES)[number];

const RANK: Record<WorkspaceRoleName, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

export class WorkspaceRole {
  static readonly owner = new WorkspaceRole('owner');
  static readonly admin = new WorkspaceRole('admin');
  static readonly member = new WorkspaceRole('member');

  private constructor(readonly value: WorkspaceRoleName) {}

  static get all(): readonly WorkspaceRole[] {
    return [WorkspaceRole.owner, WorkspaceRole.admin, WorkspaceRole.member];
  }

  static of(raw: string): WorkspaceRole {
    const named = raw.trim().toLowerCase();
    const known = WorkspaceRole.all.find((role) => role.value === named);

    if (!known) {
      throw new InvalidWorkspaceRoleError(raw.trim());
    }

    return known;
  }

  get isOwner(): boolean {
    return this.value === 'owner';
  }

  outranks(other: WorkspaceRole): boolean {
    return RANK[this.value] > RANK[other.value];
  }

  rankedAtLeast(other: WorkspaceRole): boolean {
    return RANK[this.value] >= RANK[other.value];
  }

  equals(other: WorkspaceRole): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
