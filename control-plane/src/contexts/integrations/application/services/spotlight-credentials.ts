import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';

export class SpotlightCredentials implements Credentials {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly workspaceOf: () => Promise<string>,
  ) {}

  async injectedFor(
    url: string,
    secrets: readonly string[],
  ): Promise<InjectedSecrets> {
    return this.injection.forSpotlight({
      workspaceId: await this.workspaceOf(),
      secrets,
      url,
    });
  }
}
