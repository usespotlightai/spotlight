import type { WorkspaceDetailDto } from '@application/dto/workspace.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { WorkspaceMapper } from '@application/mappers/workspace.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

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
