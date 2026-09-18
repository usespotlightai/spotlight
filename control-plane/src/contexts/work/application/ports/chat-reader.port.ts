import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export const CHAT_READER = Symbol('CHAT_READER');

export interface ChatSummary {
  readonly id: string;
  readonly title: string;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly repositories: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly working: boolean;
}

export interface ChatAuthorView {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface ChatAttachmentView {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export interface ChatProposalView {
  readonly lineId: string;
  readonly lineName: string | null;
  readonly stationId: string;
  readonly stationName: string | null;
  readonly stationColor: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly state: string;
  readonly taskId: string | null;
}

export interface ChatMessageView {
  readonly position: number;
  readonly kind: string;
  readonly body: string;
  readonly at: string;
  readonly author: ChatAuthorView | null;
  readonly runId: string | null;
  readonly attachments: readonly ChatAttachmentView[];
  readonly proposal: ChatProposalView | null;
}

export interface ChatView extends ChatSummary {
  readonly runId: string | null;
  readonly messages: readonly ChatMessageView[];
}

export interface ChatReaderPort {
  startedBy(teamId: TeamId, userId: UserId): Promise<ChatSummary[]>;

  read(
    teamId: TeamId,
    chatId: ChatId,
    viewerId: UserId,
  ): Promise<ChatView | null>;
}
