import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { HappeningDto } from '@integrations/application/dto/happening.dto';
import type { ListHappeningsQuery } from '@integrations/application/queries/list-happenings.query';
import type { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListHappeningsHandler
  implements QueryHandlerPort<ListHappeningsQuery, HappeningDto[] | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly providers: WebhookProviders,
  ) {}

  async execute(query: ListHappeningsQuery): Promise<HappeningDto[] | null> {
    try {
      const workspace = await this.workspaces.findForMember(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!workspace) {
        return null;
      }

      return this.providers.happenings.map((each) => ({
        happening: each.happening.value,
        integration: each.happening.integration,
        label: each.label,
        summary: each.summary,
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
