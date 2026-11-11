import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  ConnectionAsksPort,
  ConnectionMade,
} from '@work/application/ports/connection-asks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';

const ATTEMPTS = 3;

export class ConnectionsMade implements ConnectionAsksPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async answer(made: ConnectionMade): Promise<void> {
    const waiting = await this.tasks.awaitingConnection(
      made.teamId,
      made.personId,
      IntegrationName.of(made.integration),
    );

    for (const task of waiting) {
      await this.transaction.inTransaction(() => this.answerOn(task.id, made));
    }
  }

  private async answerOn(taskId: TaskId, made: ConnectionMade): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const task = await this.tasks.find(taskId);
      const line = task ? await this.lines.findByStation(task.stationId) : null;
      const answered =
        task?.connectionMade(
          made.teamId,
          IntegrationName.of(made.integration),
          made.personId,
          { line, at: this.clock.now() },
        ) ?? null;

      if (!answered) {
        return;
      }

      try {
        await this.tasks.save(answered);
        return;
      } catch (error) {
        if (
          !(error instanceof TaskVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
