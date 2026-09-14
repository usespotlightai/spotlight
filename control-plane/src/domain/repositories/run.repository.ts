import type { Run } from '@domain/aggregates/run.aggregate';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export interface RunEventRecord {
  readonly seq: number;
  readonly type: string;
  readonly at: Date;
  readonly message?: string;
  readonly data?: string;
}

export interface RunRepository {
  add(run: Run): Promise<void>;

  // Must be atomic: concurrent runners must never claim the same run.
  claimNext(
    harnesses: readonly HarnessId[],
    by: RunnerId,
    now: Date,
  ): Promise<Run | null>;

  findById(id: RunId): Promise<Run | null>;

  save(run: Run): Promise<void>;

  // Idempotent per attempt: retries are ignored, and a requeued run renumbers.
  appendEvents(
    id: RunId,
    attempt: number,
    events: readonly RunEventRecord[],
  ): Promise<void>;

  requeueLapsed(now: Date): Promise<Run[]>;

  releaseClaimedBy(runner: RunnerId): Promise<void>;
}
