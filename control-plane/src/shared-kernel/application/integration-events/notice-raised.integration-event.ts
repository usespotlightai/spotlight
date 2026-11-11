export const NOTICE_RAISED = 'work.notice-raised.v1';

export type NoticeRaisedIntegrationEvent = {
  readonly kind: typeof NOTICE_RAISED;
  readonly noticeId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly addressee: string | null;
  readonly at: string;
};
