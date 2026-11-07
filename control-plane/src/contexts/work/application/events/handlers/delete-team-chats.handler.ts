import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';

export class DeleteTeamChats {
  constructor(private readonly chats: ChatRepository) {}

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const chat of await this.chats.ofTeam(teamId)) {
      await this.chats.remove(chat.deleted());
    }
  }
}
