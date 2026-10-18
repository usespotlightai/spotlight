import { Score } from '@insights/domain/aggregates/score.aggregate';
import type { RunJudged } from '@insights/domain/events/run-judged.event';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RecordJudgeScore {
  constructor(
    private readonly judgings: JudgingRepository,
    private readonly scores: ScoreRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  judged(event: RunJudged): Promise<void> {
    return this.transaction.inTransaction(async () => {
      if (
        !(await this.judgings.ofForScoring(event.runId)) ||
        (await this.scores.judgeOf(event.runId, event.rubricVersion))
      ) {
        return;
      }

      await this.scores.add(
        Score.judge({
          id: ScoreId.of(this.ids.generate()),
          runId: event.runId,
          workspaceId: event.workspaceId,
          location: event.location,
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
      );
    });
  }
}
