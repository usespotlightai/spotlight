export const WORKSPACE_MEMBER_ROLE_CHANGED =
  'identity.workspace-member-role-changed.v1';

export type WorkspaceMemberRoleChangedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_MEMBER_ROLE_CHANGED;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: 'owner' | 'admin' | 'member';
};
