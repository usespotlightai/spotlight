import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import type { ReadHarnessProfileQuery } from '@configuration/application/queries/read-harness-profile.query';
import type { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadHarnessProfileHandler implements QueryHandlerPort<
  ReadHarnessProfileQuery,
  HarnessProfileResourceDto | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: HarnessProfileResourcesPort,
    private readonly views: HarnessProfileViews,
  ) {}

  async execute(
    query: ReadHarnessProfileQuery,
  ): Promise<HarnessProfileResourceDto | null> {
    try {
      const record = await this.resources.withId(
        HarnessProfileId.of(query.profileId),
      );

      if (
        !record ||
        !(await this.access.permissionsInWorkspaceOfTeam(
          record.teamId,
          query.principal,
        ))
      ) {
        return null;
      }

      return await this.views.of(record);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
