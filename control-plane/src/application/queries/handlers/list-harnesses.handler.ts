import type { HarnessDto, HarnessModelDto } from '@application/dto/harness.dto';
import type {
  HarnessCatalogueEntry,
  HarnessLaunchPort,
} from '@application/ports/harness-launch.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import type { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';

export class ListHarnessesHandler
  implements QueryHandlerPort<ListHarnessesQuery, HarnessDto[]>
{
  constructor(
    private readonly launch: HarnessLaunchPort,
    private readonly runners: RunnerReaderPort,
  ) {}

  async execute(): Promise<HarnessDto[]> {
    const advertised = await this.runners.advertisedModels();

    return this.launch
      .catalogue()
      .map((entry) => this.dtoFor(entry, advertised.get(entry.id) ?? []));
  }

  private dtoFor(
    entry: HarnessCatalogueEntry,
    discovered: readonly string[],
  ): HarnessDto {
    const models = discovered
      .map((id) => this.parsed(id))
      .filter((each): each is HarnessModel => each !== null)
      .map(
        (model): HarnessModelDto => ({ id: model.value, name: model.value }),
      );

    return {
      id: entry.id,
      name: entry.name,
      executable: entry.executable,
      models,
      defaultModel: models[0]?.id ?? '',
      efforts: [...entry.efforts],
      discovery: [...entry.discovery],
    };
  }

  private parsed(id: string): HarnessModel | null {
    try {
      return HarnessModel.of(id);
    } catch {
      return null;
    }
  }
}
