import type { TaskLinksPort } from '@work/application/ports/task-links.port';

export class WebTaskLinks implements TaskLinksPort {
  private readonly base: string;

  constructor(base: string) {
    this.base = base.replace(/\/+$/, '');
  }

  taskPage(slug: string, teamId: string, taskId: string): string {
    return this.page('w', slug, 'team', teamId, 'tasks', taskId);
  }

  conversationPage(slug: string, conversationId: string): string {
    return this.page('w', slug, 'inbox', conversationId);
  }

  chatPage(slug: string, teamId: string, chatId: string): string {
    return this.page('w', slug, 'team', teamId, 'agent', chatId);
  }

  inboxRequestPage(slug: string, inboxRequestId: string): string {
    return this.page('w', slug, 'inbox', inboxRequestId);
  }

  noticePage(slug: string, noticeId: string): string {
    return this.page('w', slug, 'inbox', 'notices', noticeId);
  }

  private page(...segments: readonly string[]): string {
    return [this.base, ...segments.map(encodeURIComponent)].join('/');
  }
}
