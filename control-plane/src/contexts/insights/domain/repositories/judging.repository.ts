import type { Judging } from '@insights/domain/aggregates/judging.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface JudgingRepository extends ScopedRemoval<Judging> {
  add(judging: Judging): Promise<void>;

  save(judging: Judging): Promise<void>;

  of(runId: RunId): Promise<Judging | null>;

  nextDueJob(now: Date): Promise<Judging | null>;
}
