export class InvalidTaskTransitionError extends Error {
  constructor(reason: string) {
    super(`The task ${reason}`);
    this.name = 'InvalidTaskTransitionError';
  }
}
