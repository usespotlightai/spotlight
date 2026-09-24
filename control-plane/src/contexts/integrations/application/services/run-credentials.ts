import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';

export class RunCredentials implements Credentials {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly workspaceId: string,
    private readonly runId: string,
  ) {}

  wornToward(url: string, secrets: readonly string[]): Promise<WornSecrets> {
    return this.injection.forRun({
      workspaceId: this.workspaceId,
      runId: this.runId,
      secrets,
      url,
    });
  }
}
