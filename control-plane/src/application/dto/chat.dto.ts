import type {
  ChatMessageView,
  ChatProposalView,
  ChatSummary,
  ChatView,
} from '@application/ports/chat-reader.port';
import { CHAT_MESSAGE_KINDS } from '@domain/entities/chat-message.entity';
import { PROPOSAL_STATES } from '@domain/entities/task-proposal.entity';

export const CHAT_MESSAGE_KIND_NAMES = CHAT_MESSAGE_KINDS;

export const PROPOSAL_STATE_NAMES = PROPOSAL_STATES;

export type ChatSummaryDto = ChatSummary;

export type ChatProposalDto = ChatProposalView;

export type ChatMessageDto = ChatMessageView;

export type ChatDto = ChatView;
