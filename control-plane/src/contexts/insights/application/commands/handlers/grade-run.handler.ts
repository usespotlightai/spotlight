import type { GradeRunCommand } from '@insights/application/commands/grade-run.command';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import type { GradingTermsOf } from '@insights/application/services/grading-terms-of.service';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { UnknownRunError } from '@insights/domain/exceptions/unknown-run.error';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import { gradeOn } from '@insights/domain/services/grading-terms';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class GradeRunHandler implements CommandHandlerPort<
  GradeRunCommand,
  void
> {
  constructor(
    private readonly access: InsightsAccess,
    private readonly terms: GradingTermsOf,
    private readonly records: RunRecordRepository,
    private readonly scores: ScoreRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: GradeRunCommand): Promise<void> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(command.teamId),
        UserId.of(command.viewerId),
      );
      const record = await this.records.of(RunId.of(command.runId));
      const end = record?.end;

      if (
        !record ||
        !end ||
        !access.covers(record.workspaceId, end.location.teamId)
      ) {
        throw new UnknownRunError(command.runId);
      }

      const run = { runId: record.runId, workspaceId: record.workspaceId, end };
      const { runId, workspaceId } = run;
      const { location } = end;

      await this.transaction.inTransaction(async () => {
        const terms = await this.terms.of(
          run,
          await this.scores.ofRuns([runId]),
        );
        const graded = {
          ...gradeOn(terms, command.value, command.claims),
          at: this.clock.now(),
        };

        await this.recorder.record(this.scores, {
          owner: FactOwner.of(workspaceId, {
            teamId: location.teamId,
            taskId: location.taskId,
          }),
          load: () => this.scores.gradeBy(runId, access.by),
          deleted: (existing) => existing.delete(),
          created: () =>
            Score.grade({
              ...graded,
              id: ScoreId.of(this.ids.generate()),
              runId,
              workspaceId,
              location,
              fingerprint: run.end.fingerprint,
              by: access.by,
            }),
          change: (existing) => existing.regrade(graded),
        });
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
