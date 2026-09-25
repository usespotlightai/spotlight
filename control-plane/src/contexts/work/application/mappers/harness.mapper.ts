import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type {
  HarnessDto,
  HarnessModelDto,
} from '@work/application/dto/harness.dto';
import type { HarnessCatalogueEntry } from '@work/application/ports/harness-launch.port';

const toDto = (
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
    versionProbe: [...entry.versionProbe],
  };
};

const parsed = (id: string): HarnessModel | null => {
  try {
    return HarnessModel.of(id);
  } catch {
    return null;
  }
};

export const HarnessMapper = { toDto };
