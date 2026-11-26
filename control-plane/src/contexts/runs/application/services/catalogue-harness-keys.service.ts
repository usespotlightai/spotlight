import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { HarnessKeySource } from '@secrets/application/ports/harness-keys.port';

export class CatalogueHarnessKeys implements HarnessKeySource {
  constructor(private readonly launch: HarnessLaunchPort) {}

  names(): readonly string[] {
    return this.launch.catalogue().flatMap((each) => each.harnessKeys);
  }
}
