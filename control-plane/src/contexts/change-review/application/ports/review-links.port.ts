export const REVIEW_LINKS = Symbol('REVIEW_LINKS');

export interface ChangeStackPage {
  readonly slug: string;
  readonly teamId: string;
  readonly runId: string;
}

export interface DecisionsPage {
  readonly slug: string;
  readonly teamId: string;
  readonly taskId: string;
}

export interface ReviewLinksPort {
  changeStackOf(page: ChangeStackPage): string;

  decisionsOf(page: DecisionsPage): string;
}
