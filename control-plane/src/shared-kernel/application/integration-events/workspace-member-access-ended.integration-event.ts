export const WORKSPACE_MEMBER_ACCESS_ENDED =
  'identity.workspace-member-access-ended.v1';

export type WorkspaceMemberAccessEndedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_MEMBER_ACCESS_ENDED;
  readonly workspaceId: string;
  readonly userId: string;
};
