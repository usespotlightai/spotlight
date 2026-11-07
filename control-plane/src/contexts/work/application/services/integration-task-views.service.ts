import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type {
  IntegrationTaskViewDto,
  SeenTaskDto,
} from '@work/application/dto/integration-task-view.dto';
import type { ChatMarksPort } from '@work/application/ports/chat-marks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export class IntegrationTaskViews {
  constructor(
    private readonly lines: LineMapsPort,
    private readonly chatMarks: ChatMarksPort,
  ) {}

  async of(task: Task, on?: LineMap): Promise<IntegrationTaskViewDto | null> {
    const line = on ?? (await this.lines.findByStation(task.stationId));
    if (!line) {
      return null;
    }

    const open = task.openConversation;

    return {
      ...(await this.seen(task, line, task.stationId)),
      waiting: open
        ? {
            conversationId: ConversationId.of({
              taskId: task.id,
              from: open.from,
            }).value,
            body: task.notes[open.from]?.body.value?.trim() ?? '',
            awaitsApproval: task.notes[open.from]?.approval?.open ?? false,
            attachments: (task.notes[open.from]?.attachments ?? []).map(
              (file) => ({
                id: file.id.value,
                name: file.name,
                contentType: file.contentType,
                size: file.size,
              }),
            ),
          }
        : null,
    };
  }

  async seen(
    task: Task,
    line: LineMap,
    stationId: StationId,
  ): Promise<SeenTaskDto> {
    const station = line.stationAt(stationId);
    const fromChat = task.proposedIn
      ? await this.chatMarks.ambientOf(task.proposedIn.chatId)
      : [];

    return {
      taskId: task.id.value,
      workspaceId: task.workspaceId.value,
      teamId: line.teamId.value,
      title: task.title.value,
      pullRequest: task.pullRequest?.value ?? null,
      line: line.key.value,
      station: station?.name.value ?? '',
      stationKey: station?.key.value ?? '',
      marks: Object.fromEntries(
        [...fromChat, ...task.marks].map((mark) => [mark.kind, mark.value]),
      ),
    };
  }
}
