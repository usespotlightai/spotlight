import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { HappeningDto } from '@integrations/application/dto/happening.dto';
import type { ListHappeningsQuery } from '@integrations/application/queries/list-happenings.query';
import type { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListHappeningsHandler
  implements QueryHandlerPort<ListHappeningsQuery, HappeningDto[] | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly sources: WebhookSources,
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

      return this.sources.happenings.map((each) => ({
        happening: each.happening.value,
        source: each.happening.source,
        label: each.label,
        told: each.told,
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
