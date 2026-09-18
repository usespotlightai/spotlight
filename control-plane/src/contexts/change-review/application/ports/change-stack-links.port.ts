export const CHANGE_STACK_LINKS = Symbol('CHANGE_STACK_LINKS');

export interface ChangeStackPage {
  readonly slug: string;
  readonly teamId: string;
  readonly runId: string;
}

export interface ChangeStackLinksPort {
  pageOf(page: ChangeStackPage): string;
}
