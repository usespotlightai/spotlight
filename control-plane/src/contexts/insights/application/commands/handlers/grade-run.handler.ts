import type { GradeRunCommand } from '@insights/application/commands/grade-run.command';
import type { RunScoresDto } from '@insights/application/dto/run-scores.dto';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import type { GradingTerms } from '@insights/domain/services/grading-terms';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const gradedOn = (
  terms: GradingTerms,
  command: GradeRunCommand,
): { value: number; claimResults: readonly boolean[] | null } => {
  if (terms.scale.byClaims) {
    if (command.claims === null || command.value !== null) {
      throw new InvalidScoreError(
        'on a claims scale must mark each claim as met or not met',
      );
    }

    return {
      value: terms.scale.valueOfClaims(command.claims, terms.claims.length),
      claimResults: [...command.claims],
    };
  }
  if (command.value === null || command.claims !== null) {
    throw new InvalidScoreError('must include a grade');
  }

  return { value: terms.scale.valueOf(command.value), claimResults: null };
};

export class GradeRunHandler
  implements CommandHandlerPort<GradeRunCommand, RunScoresDto>
{
  constructor(
    private readonly access: InsightsAccess,
    private readonly views: RunScoresViews,
    private readonly scores: ScoreRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: GradeRunCommand): Promise<RunScoresDto> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.viewerId,
      );
      const run = await this.views.onTeam(access, command.runId);

      await this.transaction.inTransaction(async () => {
        const terms = await this.views.gradingTerms(
          run,
          await this.scores.ofRuns([run.record.runId]),
        );
        const graded = {
          ...gradedOn(terms, command),
          scale: terms.scale,
          rubricVersion: terms.rubricVersion,
          at: this.clock.now(),
        };
        const existing = await this.scores.gradeBy(run.record.runId, access.by);

        if (existing) {
          const regraded = existing.regrade(graded);

          if (regraded !== existing) {
            await this.scores.save(regraded);
          }
          return;
        }

        await this.scores.add(
          Score.grade({
            ...graded,
            id: ScoreId.of(this.ids.generate()),
            runId: run.record.runId,
            workspaceId: run.record.workspaceId,
            location: run.end.location,
            fingerprint: run.end.fingerprint,
            by: access.by,
          }),
        );
      });

      return await this.views.of(access, run);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
