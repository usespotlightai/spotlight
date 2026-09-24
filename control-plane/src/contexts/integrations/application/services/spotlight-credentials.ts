import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';

export class SpotlightCredentials implements Credentials {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly workspaceOf: () => Promise<string>,
  ) {}

  async wornToward(
    url: string,
    secrets: readonly string[],
  ): Promise<WornSecrets> {
    return this.injection.forSpotlight({
      workspaceId: await this.workspaceOf(),
      secrets,
      url,
    });
  }
}
