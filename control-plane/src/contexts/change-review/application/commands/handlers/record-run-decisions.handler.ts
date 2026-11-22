import type {
  DecisionInput,
  RecordRunDecisionsCommand,
} from '@change-review/application/commands/record-run-decisions.command';
import type { RecordedDecisions } from '@change-review/application/dto/recorded-decisions.dto';
import { UnknownRunError } from '@change-review/application/errors/unknown-run.error';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { Decision } from '@change-review/domain/entities/decision.entity';
import { DecisionSetVersionConflictError } from '@change-review/domain/exceptions/decision-set-version-conflict.error';
import { DecisionsRefusedError } from '@change-review/domain/exceptions/decisions-refused.error';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { mayRecordDecisions } from '@change-review/domain/services/decision-policy';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import {
  FieldPath,
  type FieldSegment,
} from '@shared-kernel/domain/value-objects/field-path.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const problemAt = (
  segments: readonly FieldSegment[],
  reason: string,
): ConfigurationProblem =>
  ConfigurationProblem.of({ path: '', at: FieldPath.of(segments), reason });

const problemOf = (
  error: InvalidDecisionError,
  at: number | null,
): ConfigurationProblem => {
  const where: FieldSegment[] = at === null ? [] : [at];

  return problemAt(
    error.field
      ? ['decisions', ...where, error.field]
      : ['decisions', ...where],
    error.message,
  );
};

const refusedAsProblem = <T>(
  attempt: () => T,
  at: number | null,
): T | ConfigurationProblem => {
  try {
    return attempt();
  } catch (error) {
    if (error instanceof InvalidDecisionError) {
      return problemOf(error, at);
    }
    throw error;
  }
};

export class RecordRunDecisionsHandler implements CommandHandlerPort<
  RecordRunDecisionsCommand,
  RecordedDecisions
> {
  constructor(
    private readonly work: WorkPort,
    private readonly leases: RunLeasesPort,
    private readonly sets: DecisionSetRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(
    command: RecordRunDecisionsCommand,
  ): Promise<RecordedDecisions> {
    try {
      const { run, task } = await this.deciding(command);
      const read = command.decisions.map((each, at) =>
        refusedAsProblem(() => this.decisionOf(run.id, each), at),
      );
      const problems = read.filter(
        (each) => each instanceof ConfigurationProblem,
      );

      if (problems.length > 0) {
        return { outcome: 'invalid', problems };
      }

      const decisions = read.filter((each) => each instanceof Decision);
      const recordOnce = () => this.recorded(run, task, decisions);
      const recorded = await recordOnce().catch((error: unknown) => {
        if (error instanceof DecisionSetVersionConflictError) {
          return recordOnce();
        }
        throw error;
      });

      if (recorded instanceof ConfigurationProblem) {
        return { outcome: 'invalid', problems: [recorded] };
      }

      return {
        outcome: 'recorded',
        ids: decisions.map(
          (each) =>
            (recorded.decisions.find((one) => one.sameAs(each)) ?? each).id
              .value,
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private decisionOf(runId: RunId, input: DecisionInput): Decision {
    return Decision.of(DecisionId.of(this.ids.generate()), runId, input);
  }

  private async deciding(
    command: RecordRunDecisionsCommand,
  ): Promise<{ run: RunForReview; task: ReviewedTask }> {
    const runId = RunId.of(command.runId);
    const leased = await this.leases.leasedBy(
      runId,
      RunnerId.of(command.runnerId),
    );
    const run = leased ? await this.work.run(runId) : null;

    if (!run) {
      throw new UnknownRunError(command.runId);
    }

    const task = run.taskId ? await this.work.task(run.taskId) : null;

    if (run.taskId && !task) {
      throw new UnknownRunError(command.runId);
    }

    const refusal = mayRecordDecisions(run, task);

    if (refusal || !task) {
      throw new DecisionsRefusedError(refusal ?? 'works-no-task');
    }

    return { run, task };
  }

  private recorded(
    run: RunForReview,
    task: ReviewedTask,
    decisions: readonly Decision[],
  ): Promise<DecisionSet | ConfigurationProblem> {
    return this.transaction.inTransaction(async () => {
      const found = await this.sets.forTask(task.id);
      const set =
        found ??
        DecisionSet.open({
          id: DecisionSetId.of(this.ids.generate()),
          taskId: task.id,
          workspaceId: task.workspaceId,
        });
      const next = refusedAsProblem(
        () => set.recordFromRun(run.id, decisions),
        null,
      );

      if (next instanceof ConfigurationProblem) {
        return next;
      }

      if (next !== set) {
        await (found ? this.sets.save(next) : this.sets.add(next));
      }

      return next;
    });
  }
}
