import type { WorkspaceDetailDto } from '@identity/application/dto/workspace.dto';
import { WorkspaceMapper } from '@identity/application/mappers/workspace.mapper';
import type { WorkspaceProvisioningPort } from '@identity/application/ports/workspace-provisioning.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { GetWorkspaceQuery } from '@identity/application/queries/get-workspace.query';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class GetWorkspaceHandler
  implements QueryHandlerPort<GetWorkspaceQuery, WorkspaceDetailDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly provisioning: WorkspaceProvisioningPort,
  ) {}

  async execute(query: GetWorkspaceQuery): Promise<WorkspaceDetailDto | null> {
    try {
      const slug = WorkspaceSlug.of(query.slug);

      const id = await this.workspaces.identify(slug.value);

      if (!id) {
        return null;
      }

      const provisioning = await this.provisioning.of(WorkspaceId.of(id));
      const detail = await this.workspaces.findForMember(
        slug.value,
        UserId.of(query.viewerId),
      );

      return detail ? WorkspaceMapper.detailToDto(detail, provisioning) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
