import type { Judging } from '@insights/domain/aggregates/judging.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface JudgingRepository extends ScopedRemoval<Judging> {
  add(judging: Judging): Promise<void>;

  save(judging: Judging): Promise<void>;

  of(runId: RunId): Promise<Judging | null>;

  // Must lock the judging until the outer transaction ends. Then a call to delete it waits until its score is stored.
  ofForScoring(runId: RunId): Promise<Judging | null>;

  nextDueJob(now: Date): Promise<Judging | null>;
}
