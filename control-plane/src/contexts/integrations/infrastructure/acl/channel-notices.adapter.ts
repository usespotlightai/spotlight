import type { NotifyChannel } from '@integrations/application/services/notify-channel.service';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BindableChatEvent } from '@work/application/contracts/bindable-chat-events.contract';
import type {
  ChannelNoticeDto,
  ChannelNoticesPort,
} from '@work/application/ports/channel-notices.port';

export class ChannelNotices implements ChannelNoticesPort {
  constructor(private readonly notices: NotifyChannel) {}

  notify(notice: ChannelNoticeDto, event: BindableChatEvent): Promise<void> {
    return this.notices.notify(
      {
        workspaceId: WorkspaceId.of(notice.workspaceId),
        teamId: TeamId.of(notice.teamId),
        marks: Object.fromEntries(
          notice.marks.map((each) => [each.kind, each.value]),
        ),
        body: notice.body,
        proposals: notice.proposals.map((each) => ({
          number: each.number,
          title: each.title,
          line: each.line,
          station: each.station,
        })),
        chatId: notice.chatId,
        taskId: notice.taskId === null ? null : TaskId.of(notice.taskId),
      },
      event,
    );
  }
}
