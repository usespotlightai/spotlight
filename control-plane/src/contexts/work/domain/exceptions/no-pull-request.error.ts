export class NoPullRequestError extends Error {
  readonly kind = 'invalid' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} has no pull request.`);
    this.name = 'NoPullRequestError';
  }
}
