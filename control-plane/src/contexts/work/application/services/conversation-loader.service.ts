import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export interface Conversing {
  readonly item: ConversationId;
  readonly task: Task;
  readonly line: LineMap | null;
}

export interface ActedOnConversation extends Conversing {
  readonly line: LineMap;
}

export class ConversationLoader {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly access: WorkAccess,
  ) {}

  async putTo(itemId: string, them: string): Promise<ActedOnConversation> {
    const { item, task, line } = await this.seenBy(itemId, them);
    const unknown = () => new UnknownTaskError(task.id.value);

    if (!line) {
      throw unknown();
    }

    (
      await this.access.standingOn(line.teamId, UserId.of(them))
    ).assertActsOnTasks(unknown);

    return { item, task, line };
  }

  async seenBy(itemId: string, them: string): Promise<Conversing> {
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
    };
  }
}
