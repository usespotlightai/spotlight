import type { PendingMessageDto } from '@application/dto/pending-message.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { PendingMessagesQuery } from '@application/queries/pending-messages.query';
import { Attached } from '@application/rendering/attached';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { RunId } from '@domain/value-objects/run-id.vo';

/**
 * What a person has said to the agent working this run and no run has taken
 * up yet. Read by the runner between turns.
 */
export class PendingMessagesHandler
  implements QueryHandlerPort<PendingMessagesQuery, PendingMessageDto[]>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(query: PendingMessagesQuery): Promise<PendingMessageDto[]> {
    try {
      const run = await this.runs.findById(RunId.of(query.runId));
      const task = run?.taskId ? await this.tasks.find(run.taskId) : null;

      if (!task) {
        return [];
      }

      return task.undelivered.map((note) => ({
        position: task.notes.indexOf(note),
        body: Attached.beside(note.body.value, note.attachments),
        attachments: Attached.shapes(note.attachments),
      }));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
