import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ChatSummaryDto } from '@work/application/dto/chat.dto';
import type { ChatReaderPort } from '@work/application/ports/chat-reader.port';
import type { ListChatsQuery } from '@work/application/queries/chat.queries';

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
      rethrowAsApplicationError(error);
    }
  }
}
