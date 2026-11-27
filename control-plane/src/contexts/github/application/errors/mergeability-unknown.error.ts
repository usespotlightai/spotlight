export class MergeabilityUnknownError extends Error {
  constructor(pullRequest: string) {
    super(
      `GitHub has not computed yet whether ${pullRequest} merges, so it is read again`,
    );
    this.name = 'MergeabilityUnknownError';
  }
}
