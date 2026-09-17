import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  HarnessDto,
  HarnessModelDto,
} from '@work/application/dto/harness.dto';
import type {
  HarnessCatalogueEntry,
  HarnessLaunchPort,
} from '@work/application/ports/harness-launch.port';
import type {
  HarnessCatalogueQuery,
  ListHarnessesQuery,
} from '@work/application/queries/list-harnesses.query';

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

      const advertised = await this.runners.advertisedModels(
        membership.workspaceId,
      );

      return this.launch
        .catalogue()
        .map((entry) => dtoFor(entry, advertised.get(entry.id) ?? []));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class HarnessCatalogueHandler
  implements QueryHandlerPort<HarnessCatalogueQuery, HarnessDto[]>
{
  constructor(private readonly launch: HarnessLaunchPort) {}

  async execute(): Promise<HarnessDto[]> {
    return this.launch.catalogue().map((entry) => dtoFor(entry, []));
  }
}

const dtoFor = (
  entry: HarnessCatalogueEntry,
  discovered: readonly string[],
): HarnessDto => {
  const models = discovered
    .map((id) => parsed(id))
    .filter((each): each is HarnessModel => each !== null)
    .map((model): HarnessModelDto => ({ id: model.value, name: model.value }));

  return {
    id: entry.id,
    name: entry.name,
    executable: entry.executable,
    models,
    defaultModel: models[0]?.id ?? '',
    efforts: [...entry.efforts],
    discovery: [...entry.discovery],
  };
};

const parsed = (id: string): HarnessModel | null => {
  try {
    return HarnessModel.of(id);
  } catch {
    return null;
  }
};
