export class PullRequestsNotPurgedError extends Error {
  constructor(left: number) {
    super(
      `${left} of the workspace's pull requests could not be purged yet, so purging them is tried again`,
    );
    this.name = 'PullRequestsNotPurgedError';
  }
}
