import type { RunnerId } from '@domain/value-objects/runner-id.vo';

/** A runner's token has been retired, so it can no longer serve the work it holds. */
export class RunnerRevoked {
  constructor(readonly runnerId: RunnerId) {}
}
