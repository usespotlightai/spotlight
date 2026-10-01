export class PullRequestsNotForgottenError extends Error {
  constructor(left: number) {
    super(
      `${left} of the workspace's pull requests could not be forgotten yet, so forgetting them is tried again`,
    );
    this.name = 'PullRequestsNotForgottenError';
  }
}
