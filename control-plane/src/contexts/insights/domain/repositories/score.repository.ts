import type { Score } from '@insights/domain/aggregates/score.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ScoreRepository extends ScopedRemoval<Score> {
  add(score: Score): Promise<void>;

  save(score: Score): Promise<void>;

  of(runId: RunId, rubricVersion: RubricVersion): Promise<Score | null>;
}
