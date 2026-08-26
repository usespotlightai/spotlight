import type { Run } from '@domain/aggregates/run.aggregate';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export interface RunEventRecord {
  readonly seq: number;
  readonly type: string;
  readonly at: Date;
  readonly message?: string;
  readonly data?: string;
  readonly offset?: number;
}

export interface RunRepository {
  add(run: Run): Promise<void>;

  /**
   * Hands the oldest queued run in the pool to one runner, atomically. Two
   * runners asking at the same moment must not both receive it.
   */
  claimNext(pool: string, by: RunnerId, now: Date): Promise<Run | null>;

  findById(id: RunId): Promise<Run | null>;

  save(run: Run): Promise<void>;

  /**
   * Ignores events already recorded, so a batch the runner retried is not
   * appended twice. Scoped to the attempt, because a requeued run starts
   * numbering again and its second telling is not a duplicate of its first.
   */
  appendEvents(
    id: RunId,
    attempt: number,
    events: readonly RunEventRecord[],
  ): Promise<void>;

  /** Returns claimed runs whose lease has lapsed to the queue. */
  requeueLapsed(now: Date): Promise<number>;

  /**
   * Puts back whatever this runner is holding. The query narrows the
   * candidates; `Run.release` decides, so the rule is stated once.
   */
  releaseClaimedBy(runner: RunnerId): Promise<number>;
}
