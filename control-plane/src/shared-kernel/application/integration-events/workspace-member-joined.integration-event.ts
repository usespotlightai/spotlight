export const WORKSPACE_MEMBER_JOINED = 'identity.workspace-member-joined.v1';

export type WorkspaceRolePublished = 'owner' | 'admin' | 'member';

export type WorkspaceMemberJoinedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_MEMBER_JOINED;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceRolePublished;
};
