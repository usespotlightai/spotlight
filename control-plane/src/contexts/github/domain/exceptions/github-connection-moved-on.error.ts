export class GitHubConnectionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor() {
    super(
      'The GitHub connection of this workspace has been changed since it was read, and cannot be written over',
    );
    this.name = 'GitHubConnectionMovedOnError';
  }
}
