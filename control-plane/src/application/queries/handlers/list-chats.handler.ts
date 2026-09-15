import type { ChatSummaryDto } from '@application/dto/chat.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ChatReaderPort } from '@application/ports/chat-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ListChatsQuery } from '@application/queries/chat.queries';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ListChatsHandler
  implements QueryHandlerPort<ListChatsQuery, ChatSummaryDto[] | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly chats: ChatReaderPort,
  ) {}

  async execute(query: ListChatsQuery): Promise<ChatSummaryDto[] | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const member = await this.workspaces.findTeamForMember(
        query.teamId,
        viewer,
      );

      if (!member) {
        return null;
      }

      return await this.chats.startedBy(TeamId.of(member.teamId), viewer);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
