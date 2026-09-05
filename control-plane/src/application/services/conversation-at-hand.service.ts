import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export interface Conversing {
  readonly item: ConversationId;
  readonly task: Task;
  readonly line: AssemblyLine | null;
  /** Where the task stands, which is who a person is speaking to. */
  readonly station: StationName;
}

/** Everything a person may reach from their inbox is decided here. */
export class ConversationAtHand {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
  ) {}

  async putTo(itemId: string, them: string): Promise<Conversing> {
    const item = ConversationId.parse(itemId);
    const task = await this.tasks.find(item.taskId);

    // An inbox is one person's: a conversation not assigned to them is one they
    // cannot see, so it is not there to answer.
    if (!task?.assignedToThem(UserId.of(them))) {
      throw new UnknownTaskError(item.taskId.value);
    }

    const line = await this.lines.holding(task.stationId);

    return {
      item,
      task,
      line,
      station: line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
    };
  }
}
