export class ReactionDeferredError extends Error {
  constructor(reason: string) {
    super(`Work could not react yet, so it is asked again: ${reason}`);
    this.name = 'ReactionDeferredError';
  }
}
