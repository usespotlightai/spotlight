import { runOutcomeOf } from '@outcomes/application/dto/run-outcome.dto';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';

export class RunOutcomes implements RunOutcomesPort {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly deliveries: TaskDeliveryRepository,
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
    const deliveries = (
      await this.deliveries.forTasks(
        ended.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      )
    ).flatMap((each) => {
      const known = asOf ? each.asOf(asOf) : each;
      return known ? [known] : [];
    });
    return new Map(
      ended.flatMap((record) => {
        const outcome = runOutcomeOf(record, deliveries);

        if (!outcome) {
          return [];
        }

        const {
          taskId: _taskId,
          cost: _cost,
          passed: _passed,
          ...shape
        } = outcome;

        return [[outcome.runId, shape] as const];
      }),
    );
  }
}
