import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';

const nameable = (raw: string): HarnessModel | null => {
  try {
    return HarnessModel.of(raw);
  } catch {
    return null;
  }
};

export class InstalledHarness {
  private readonly kind = 'installed-harness' as const;

  private constructor(
    readonly id: HarnessId,
    readonly models: readonly HarnessModel[],
  ) {}

  static of(id: HarnessId, models: readonly HarnessModel[]): InstalledHarness {
    return new InstalledHarness(
      id,
      models.filter(
        (model, at) => models.findIndex((each) => each.equals(model)) === at,
      ),
    );
  }

  static reported(id: string, models: readonly string[]): InstalledHarness {
    return InstalledHarness.of(
      HarnessId.of(id),
      models
        .map(nameable)
        .filter((each): each is HarnessModel => each !== null),
    );
  }

  equals(other: InstalledHarness): boolean {
    return (
      this.kind === other.kind &&
      this.id.equals(other.id) &&
      this.models.length === other.models.length &&
      this.models.every((model, at) => model.equals(other.models[at]))
    );
  }
}
