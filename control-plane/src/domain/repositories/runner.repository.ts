import type { Runner } from '@domain/aggregates/runner.aggregate';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export interface RunnerRepository {
  add(runner: Runner): Promise<void>;

  find(id: RunnerId): Promise<Runner | null>;

  /** Records that a runner is still there; the claim doubles as a heartbeat. */
  touch(id: RunnerId, at: Date): Promise<void>;
}
