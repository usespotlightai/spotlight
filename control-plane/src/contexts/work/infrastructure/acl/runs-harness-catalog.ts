import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';

export class RunsHarnessCatalog implements HarnessCatalog {
  constructor(private readonly launch: HarnessLaunchPort) {}

  knows(id: HarnessId): boolean {
    return this.launch.catalogue().some((each) => each.id === id.value);
  }
}
