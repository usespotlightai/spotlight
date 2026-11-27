import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ChatLoader {
  constructor(
    private readonly chats: ChatRepository,
    private readonly access: WorkAccess,
  ) {}

  async openableBy(
    teamId: string,
    chatId: string,
    viewer: string,
  ): Promise<Chat | null> {
    const chat = await this.chats.find(ChatId.of(chatId));

    return chat?.isOf(TeamId.of(teamId)) &&
      (await this.access.opensChat(chat, UserId.of(viewer)))
      ? chat
      : null;
  }

  async openedBy(
    teamId: string,
    chatId: string,
    viewer: string,
  ): Promise<Chat> {
    const chat = await this.openableBy(teamId, chatId, viewer);

    if (!chat) {
      throw new UnknownChatError(chatId);
    }

    return chat;
  }

  async inInboxOf(chatId: string, slug: string, person: string): Promise<Chat> {
    const viewer = UserId.of(person);
    const chat = await this.chats.find(ChatId.of(chatId));
    const team = chat ? await this.access.seenTeam(chat.teamId, viewer) : null;

    if (
      !chat ||
      !team ||
      team.slug !== slug ||
      !team.workspaceId.equals(chat.workspaceId) ||
      !(await this.access.standingOn(chat.teamId, viewer)).seesTasks
    ) {
      throw new UnknownChatError(chatId);
    }

    return chat;
  }
}
