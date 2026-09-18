import type {
  ChangeStackLinksPort,
  ChangeStackPage,
} from '@change-review/application/ports/change-stack-links.port';

export class WebChangeStackLinks implements ChangeStackLinksPort {
  constructor(private readonly publicUrl: string) {}

  pageOf(page: ChangeStackPage): string {
    const path = [
      'w',
      page.slug,
      'team',
      page.teamId,
      'runs',
      page.runId,
      'changes',
    ]
      .map(encodeURIComponent)
      .join('/');

    return `${this.publicUrl.replace(/\/+$/, '')}/${path}`;
  }
}
