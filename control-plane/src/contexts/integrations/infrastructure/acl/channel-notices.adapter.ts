import type { NotifyChannel } from '@integrations/application/services/notify-channel.service';
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
        workspaceId: notice.workspaceId,
        teamId: notice.teamId,
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
        taskId: notice.taskId,
      },
      event,
    );
  }
}
