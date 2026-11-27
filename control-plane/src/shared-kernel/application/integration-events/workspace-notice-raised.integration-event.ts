export const WORKSPACE_NOTICE_RAISED = 'work.workspace-notice-raised.v1';

// A notice about the whole workspace, for its owners and admins, was raised or opened again. It belongs to no team.
export type WorkspaceNoticeRaisedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_NOTICE_RAISED;
  readonly noticeId: string;
  readonly workspaceId: string;
  readonly at: string;
};
