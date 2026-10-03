import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type {
  HarnessOffer,
  HarnessOffersPort,
} from '@work/application/ports/harness-offers.port';

export class HarnessOffers implements HarnessOffersPort {
  constructor(
    private readonly launch: HarnessLaunchPort,
    private readonly runners: RunnerReaderPort,
  ) {}

  async offerOf(
    workspaceId: string,
    harness: string,
  ): Promise<HarnessOffer | null> {
    const entry = this.launch.catalogue().find((each) => each.id === harness);

    if (!entry) {
      return null;
    }

    const advertised = await this.runners.advertisedModels(
      WorkspaceId.of(workspaceId),
    );

    return {
      models: [...(advertised.get(harness) ?? [])],
      efforts: [...entry.efforts],
    };
  }
}
