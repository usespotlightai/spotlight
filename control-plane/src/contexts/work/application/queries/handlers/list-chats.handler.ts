import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ChatSummaryDto } from '@work/application/dto/chat.dto';
import type { Page } from '@work/application/dto/page.dto';
import type { ChatReaderPort } from '@work/application/ports/chat-reader.port';
import type { ListChatsQuery } from '@work/application/queries/chat.queries';
import type { WorkAccess } from '@work/application/services/work-access.service';

export class ListChatsHandler
  implements QueryHandlerPort<ListChatsQuery, Page<ChatSummaryDto> | null>
{
  constructor(
    private readonly access: WorkAccess,
    private readonly chats: ChatReaderPort,
  ) {}

  async execute(query: ListChatsQuery): Promise<Page<ChatSummaryDto> | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const member = await this.access.seenTeam(
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
