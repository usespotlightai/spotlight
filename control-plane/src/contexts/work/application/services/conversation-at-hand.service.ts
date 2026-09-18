import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

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
