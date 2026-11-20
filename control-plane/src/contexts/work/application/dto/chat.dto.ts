import type {
  ChatSummary,
  ChatView,
} from '@work/application/ports/chat-reader.port';
import { CHAT_PULL_REQUEST_STATES } from '@work/application/read-models/chat-pull-request-state';
import { CHAT_MESSAGE_KINDS } from '@work/domain/entities/chat-message.entity';
import { PROPOSAL_STATES } from '@work/domain/entities/task-proposal.entity';

export const CHAT_MESSAGE_KIND_NAMES = CHAT_MESSAGE_KINDS;

export const PROPOSAL_STATE_NAMES = PROPOSAL_STATES;

export const CHAT_PULL_REQUEST_STATE_NAMES = CHAT_PULL_REQUEST_STATES;

export type ChatSummaryDto = ChatSummary;

export type ChatDto = ChatView;
