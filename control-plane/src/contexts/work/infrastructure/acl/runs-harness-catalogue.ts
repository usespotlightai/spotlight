import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessCataloguePort } from '@work/application/ports/harness-catalogue.port';
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';

export class RunsHarnessCatalogue implements HarnessCataloguePort {
  constructor(private readonly launch: HarnessLaunchPort) {}

  current(): HarnessCatalogue {
    return HarnessCatalogue.of(
      this.launch.catalogue().map((each) => HarnessId.of(each.id)),
    );
  }
}
