export class UnreviewablePullRequestError extends Error {
  readonly violation = 'invalid' as const;

  constructor(url: string) {
    super(
      `A task reviews only a pull request whose head it can check out, and ${url} names none`,
    );
    this.name = 'UnreviewablePullRequestError';
  }
}
