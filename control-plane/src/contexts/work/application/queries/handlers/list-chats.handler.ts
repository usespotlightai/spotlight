import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ChatSummaryDto } from '@work/application/dto/chat.dto';
import type { Page } from '@work/application/dto/page.dto';
import type { ChatReaderPort } from '@work/application/ports/chat-reader.port';
import type { ListChatsQuery } from '@work/application/queries/chat.queries';

export class ListChatsHandler
  implements QueryHandlerPort<ListChatsQuery, Page<ChatSummaryDto> | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly chats: ChatReaderPort,
  ) {}

  async execute(query: ListChatsQuery): Promise<Page<ChatSummaryDto> | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const member = await this.workspaces.findTeamForMember(
        TeamId.of(query.teamId),
        viewer,
      );

      if (!member) {
        return null;
      }

      return await this.chats.startedBy(member.teamId, viewer, query.page);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
