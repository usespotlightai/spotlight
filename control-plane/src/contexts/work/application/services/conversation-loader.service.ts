import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface Conversing {
  readonly item: ConversationId;
  readonly task: Task;
  readonly line: LineMap | null;
  readonly station: Station | null;
}

export class ConversationLoader {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
  ) {}

  async putTo(itemId: string, them: string): Promise<Conversing> {
    const item = ConversationId.parse(itemId);
    const task = await this.tasks.find(item.taskId);

    if (!task?.assignedToThem(UserId.of(them))) {
      throw new UnknownTaskError(item.taskId.value);
    }

    const line = await this.lines.findByStation(task.stationId);

    return {
      item,
      task,
      line,
      station: line?.stationAt(task.stationId) ?? null,
    };
  }
}
