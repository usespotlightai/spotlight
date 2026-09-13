import type { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export interface Conversing {
  readonly item: ConversationId;
  readonly task: Task;
  readonly line: Line | null;
  readonly station: StationName;
}

export class ConversationAtHand {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
  ) {}

  async putTo(itemId: string, them: string): Promise<Conversing> {
    const item = ConversationId.parse(itemId);
    const task = await this.tasks.find(item.taskId);

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
