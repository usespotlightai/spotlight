import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { Progress } from '@work/domain/value-objects/run-state';

export const CHAT_READER = Symbol('CHAT_READER');

interface ChatTargetStationView {
  readonly lineId: string;
  readonly lineKey: string;
  readonly lineName: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly stationName: string;
}

interface ChatSetupView {
  readonly repository: string;
  readonly folder: string;
  readonly pullRequest: string | null;
}

export interface ChatSummary {
  readonly id: string;
  readonly title: string;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly repositories: readonly string[];
  readonly targetStation: ChatTargetStationView | null;
  readonly setup: ChatSetupView | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly progress: Progress | null;
}

interface ChatAuthorView {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

interface ChatAttachmentView {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

interface ChatTraceView {
  readonly taskId: string;
  readonly title: string;
}

interface ChatProposalView {
  readonly lineId: string;
  readonly lineName: string | null;
  readonly stationId: string;
  readonly stationName: string | null;
  readonly stationColor: string | null;
  readonly stationPosition: number | null;
  readonly stationCount: number | null;
  readonly title: string;
  readonly description: string | null;
  readonly state: string;
  readonly taskId: string | null;
}

interface ChatMessageView {
  readonly position: number;
  readonly kind: string;
  readonly body: string;
  readonly at: string;
  readonly author: ChatAuthorView | null;
  readonly runId: string | null;
  readonly attachments: readonly ChatAttachmentView[];
  readonly traces: readonly ChatTraceView[];
  readonly proposal: ChatProposalView | null;
}

export interface ChatView extends ChatSummary {
  readonly runId: string | null;
  readonly messages: readonly ChatMessageView[];
}

interface SetupCiView {
  readonly defaultBranch: string;
  readonly defaultBranchProtected: boolean;
  readonly variables: 'written' | 'not-permitted';
}

export interface SetupChatView {
  readonly id: string;
  readonly repository: string;
  readonly pullRequest: string | null;
  readonly ci: SetupCiView | null;
  readonly startedById: string;
  readonly startedBy: string;
}

export interface ChatReaderPort {
  startedBy(teamId: TeamId, userId: UserId): Promise<ChatSummary[]>;

  read(
    teamId: TeamId,
    chatId: ChatId,
    viewerId: UserId,
  ): Promise<ChatView | null>;

  setupOf(teamId: TeamId): Promise<SetupChatView | null>;
}
