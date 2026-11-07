import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import type { RunJudged } from '@insights/domain/events/run-judged.event';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RecordJudgeScore {
  constructor(
    private readonly scores: ScoreRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  judged(event: RunJudged): Promise<void> {
    const { location } = event;

    return this.transaction.inTransaction(() =>
      this.recorder.record(this.scores, {
        owner: FactOwner.of(event.workspaceId, {
          teamId: location.teamId,
          taskId: location.taskId,
        }),
        load: () => this.scores.judgeOf(event.runId, event.rubricVersion),
        erased: (existing) => existing.erased(),
        created: () =>
          Score.judge({
            id: ScoreId.of(this.ids.generate()),
            runId: event.runId,
            workspaceId: event.workspaceId,
            location,
            fingerprint: event.fingerprint,
            scale: event.scale,
            value: event.value,
            claimResults: event.claimResults,
            rubricVersion: event.rubricVersion,
            model: event.model,
            reasons: event.reasons,
            seen: event.seen,
            at: event.at,
          }),
        change: (score) => score,
      }),
    );
  }
}
