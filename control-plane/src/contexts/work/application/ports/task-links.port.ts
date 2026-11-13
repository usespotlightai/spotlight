export const TASK_LINKS = Symbol('TASK_LINKS');

export interface TaskLinksPort {
  taskPage(slug: string, teamId: string, taskId: string): string;

  conversationPage(slug: string, conversationId: string): string;

  chatPage(slug: string, teamId: string, chatId: string): string;

  inboxRequestPage(slug: string, inboxRequestId: string): string;

  noticePage(slug: string, noticeId: string): string;
}
