import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type {
  ConversationStanding,
  ConversationViewer,
} from '@work/domain/services/conversation-audience';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export interface Conversing {
  readonly item: ConversationId;
  readonly task: Task;
  readonly standing: ConversationStanding | null;
}

export interface ActedOnConversation {
  readonly item: ConversationId;
  readonly task: Task;
  readonly line: LineMap;
  readonly viewer: ConversationViewer;
}

interface Found {
  readonly item: ConversationId;
  readonly task: Task | null;
  readonly line: LineMap | null;
  readonly viewer: ConversationViewer;
}

export class ConversationLoader {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly access: WorkAccess,
  ) {}

  async putTo(itemId: string, them: string): Promise<ActedOnConversation> {
    const { item, task, line, viewer } = await this.found(itemId, them);

    if (!task || !line || !viewer.team.seesTasks) {
      throw new UnknownTaskError(item.taskId.value);
    }

    return { item, task, line, viewer };
  }

  async seenBy(itemId: string, them: string): Promise<Conversing> {
    const { item, task, viewer } = await this.found(itemId, them);
    const conversant = task?.conversantOf(viewer);

    if (!task || !conversant || (!conversant.standing && !conversant.drives)) {
      throw new UnknownTaskError(item.taskId.value);
    }

    return { item, task, standing: conversant.standing };
  }

  private async found(itemId: string, them: string): Promise<Found> {
    const item = ConversationId.parse(itemId);
    const person = UserId.of(them);
    const task = await this.tasks.find(item.taskId);
    const line = task ? await this.lines.findByStation(task.stationId) : null;
    const team = line
      ? await this.access.standingOn(line.teamId, person)
      : TeamStanding.outside();

    return { item, task, line, viewer: { person, team } };
  }
}
