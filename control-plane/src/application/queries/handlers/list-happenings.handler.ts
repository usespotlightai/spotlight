import type { HappeningDto } from '@application/dto/happening.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ListHappeningsQuery } from '@application/queries/list-happenings.query';
import type { WebhookSources } from '@application/services/webhook-sources.service';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * Everything a station here could be set to wait for. Asked of the sources
 * rather than of a list somebody has to remember to update.
 */
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
      rethrowAsFault(error);
    }
  }
}
