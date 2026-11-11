import type {
  ChangeStackPage,
  DecisionsPage,
  ReviewLinksPort,
} from '@change-review/application/ports/review-links.port';

export class WebReviewLinks implements ReviewLinksPort {
  constructor(private readonly publicUrl: string) {}

  changeStackOf(page: ChangeStackPage): string {
    return this.at([
      'w',
      page.slug,
      'team',
      page.teamId.value,
      'runs',
      page.runId.value,
      'changes',
    ]);
  }

  decisionsOf(page: DecisionsPage): string {
    return `${this.at(['w', page.slug, 'team', page.teamId.value, 'tasks', page.taskId.value])}#decisions`;
  }

  private at(parts: readonly string[]): string {
    return `${this.publicUrl.replace(/\/+$/, '')}/${parts.map(encodeURIComponent).join('/')}`;
  }
}
