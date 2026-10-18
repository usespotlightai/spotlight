import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';

export class IntegrationTaskViews {
  constructor(private readonly lines: LineRepository) {}

  async of(task: Task, on?: Line): Promise<IntegrationTaskViewDto | null> {
    const line = on ?? (await this.lines.findByStation(task.stationId));
    if (!line) {
      return null;
    }

    const station = line.stationAt(task.stationId);
    const open = task.openConversation;

    return {
      taskId: task.id.value,
      workspaceId: task.workspaceId.value,
      teamId: line.teamId.value,
      line: line.key.value,
      station: station?.name.value ?? '',
      stationKey: station?.key.value ?? '',
      marks: Object.fromEntries(
        task.marks.map((mark) => [mark.kind, mark.value]),
      ),
      waiting: open
        ? {
            conversationId: ConversationId.of({
              taskId: task.id,
              from: open.from,
            }).value,
            body: task.notes[open.from]?.body.value?.trim() ?? '',
            awaitsApproval: task.notes[open.from]?.approval?.open ?? false,
          }
        : null,
    };
  }
}
