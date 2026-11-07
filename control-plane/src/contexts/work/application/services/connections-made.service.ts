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
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

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
      made.integration,
    );

    for (const task of waiting) {
      await this.transaction.inTransaction(() => this.answerOn(task.id, made));
    }
  }

  private async answerOn(taskId: TaskId, made: ConnectionMade): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const task = await this.tasks.find(taskId);
      const line = task ? await this.lines.findByStation(task.stationId) : null;
      const asked = task?.openConversation
        ? task.notes[task.openConversation.from]
        : undefined;
      const answered =
        task && asked
          ? task.connectionMade(made.teamId, made.integration, made.personId, {
              station: line?.stationAt(task.stationId) ?? null,
              body: TaskNoteBody.of(
                `Connected ${asked.connectionAsk?.integrationName ?? made.integration}.`,
              ),
              at: this.clock.now(),
              voice: Voice.person(made.personId),
            })
          : null;

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
