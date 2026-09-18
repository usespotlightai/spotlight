import type { WorkspaceDetailDto } from '@identity/application/dto/workspace.dto';
import { WorkspaceMapper } from '@identity/application/mappers/workspace.mapper';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { GetWorkspaceQuery } from '@identity/application/queries/get-workspace.query';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class GetWorkspaceHandler
  implements QueryHandlerPort<GetWorkspaceQuery, WorkspaceDetailDto | null>
{
  constructor(private readonly workspaces: WorkspaceReaderPort) {}

  async execute(query: GetWorkspaceQuery): Promise<WorkspaceDetailDto | null> {
    try {
      const slug = WorkspaceSlug.of(query.slug);

      const detail = await this.workspaces.findForMember(
        slug.value,
        UserId.of(query.viewerId),
      );

      return detail ? WorkspaceMapper.detailToDto(detail) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
