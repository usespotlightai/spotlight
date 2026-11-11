export const TASK_CONVERSATION_REOPENED = 'work.task-conversation-reopened.v1';

export type TaskConversationReopenedIntegrationEvent = {
  readonly kind: typeof TASK_CONVERSATION_REOPENED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly at: string;
};
