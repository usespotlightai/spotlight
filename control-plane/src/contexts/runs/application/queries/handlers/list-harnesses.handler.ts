import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { HarnessDto } from '@runs/application/dto/harness.dto';
import { HarnessMapper } from '@runs/application/mappers/harness.mapper';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type {
  HarnessCatalogueQuery,
  ListHarnessesQuery,
} from '@runs/application/queries/list-harnesses.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListHarnessesHandler
  implements QueryHandlerPort<ListHarnessesQuery, HarnessDto[] | null>
{
  constructor(
    private readonly launch: HarnessLaunchPort,
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerReaderPort,
  ) {}

  async execute(query: ListHarnessesQuery): Promise<HarnessDto[] | null> {
    try {
      const membership = await this.access.inWorkspace(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!membership) {
        return null;
      }

      const supported = await this.runners.supportedModels(
        membership.workspaceId,
      );

      return this.launch
        .catalogue()
        .map((entry) =>
          HarnessMapper.toDto(entry, supported.get(entry.id) ?? []),
        );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class HarnessCatalogueHandler
  implements QueryHandlerPort<HarnessCatalogueQuery, HarnessDto[]>
{
  constructor(private readonly launch: HarnessLaunchPort) {}

  async execute(): Promise<HarnessDto[]> {
    return this.launch
      .catalogue()
      .map((entry) => HarnessMapper.toDto(entry, []));
  }
}
