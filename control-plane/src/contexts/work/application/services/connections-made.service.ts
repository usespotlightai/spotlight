import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TaskMovedOnError } from '@work/domain/exceptions/task-moved-on.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const ATTEMPTS = 3;

export interface ConnectionMade {
  readonly teamId: TeamId;
  readonly source: string;
  readonly personId: UserId;
}

export class ConnectionsMade {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
  ) {}

  async answer(made: ConnectionMade): Promise<void> {
    const waiting = await this.tasks.awaitingConnection(
      made.teamId,
      made.personId,
      made.source,
    );

    for (const task of waiting) {
      await this.answerOn(task.id, made);
    }
  }

  private async answerOn(taskId: TaskId, made: ConnectionMade): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const task = await this.tasks.find(taskId);
      const asked = task?.openConversation
        ? task.notes[task.openConversation.from]
        : undefined;
      const answered =
        task && asked
          ? task.connectionMade(made.teamId, made.source, made.personId, {
              station: asked.station,
              body: TaskNoteBody.of(
                `Connected ${asked.connectionAsk?.integration ?? made.source}.`,
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
        if (!(error instanceof TaskMovedOnError) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }
}
