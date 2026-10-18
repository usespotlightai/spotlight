import { runOutcomeOf } from '@insights/application/dto/run-outcome.dto';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';

export class RunOutcomes implements RunOutcomesPort {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly taskPullRequests: TaskPullRequestRepository,
  ) {}

  async of(
    runIds: readonly string[],
    asOf: Date | null,
  ): Promise<ReadonlyMap<string, RunOutcomeShape>> {
    const records = (
      await this.records.ofRuns(
        runIds.filter((each) => each.trim()).map(RunId.of),
      )
    ).map((each) => (asOf ? each.asOf(asOf) : each));
    const ended = records.filter((each) => each.hasEnded);
    const taskPullRequests = (
      await this.taskPullRequests.forTasks(
        ended.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      )
    ).flatMap((each) => {
      const known = asOf ? each.asOf(asOf) : each;
      return known ? [known] : [];
    });
    return new Map(
      ended.flatMap((record) => {
        const outcome = runOutcomeOf(record, taskPullRequests);

        if (!outcome) {
          return [];
        }

        const {
          taskId: _taskId,
          usage: _usage,
          passed: _passed,
          ...shape
        } = outcome;

        return [[outcome.runId, shape] as const];
      }),
    );
  }
}
