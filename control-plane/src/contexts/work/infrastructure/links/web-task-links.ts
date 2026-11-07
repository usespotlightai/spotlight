import type { TaskLinksPort } from '@work/application/ports/task-links.port';

export class WebTaskLinks implements TaskLinksPort {
  private readonly base: string;

  constructor(base: string) {
    this.base = base.replace(/\/+$/, '');
  }

  taskPage(slug: string, teamId: string, taskId: string): string {
    return `${this.base}/w/${slug}/team/${teamId}/tasks/${taskId}`;
  }

  conversationPage(slug: string, conversationId: string): string {
    return `${this.base}/w/${slug}/inbox/${conversationId}`;
  }

  chatPage(slug: string, teamId: string, chatId: string): string {
    return `${this.base}/w/${slug}/team/${teamId}/agent/${chatId}`;
  }
}
