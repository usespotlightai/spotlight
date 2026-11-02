import type { BindableChatEvent } from '@work/application/contracts/bindable-chat-events.contract';
import type { TaskMark } from '@work/application/contracts/happenings.contract';

export const CHANNEL_NOTICES = Symbol('CHANNEL_NOTICES');

export interface ChannelNoticeDto {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly marks: readonly TaskMark[];
  readonly body: string;
  readonly chatId: string | null;
  readonly taskId: string | null;
}

export interface ChannelNoticesPort {
  notify(notice: ChannelNoticeDto, event: BindableChatEvent): Promise<void>;
}
