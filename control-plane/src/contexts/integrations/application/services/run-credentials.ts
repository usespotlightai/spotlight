import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';

export class RunCredentials implements Credentials {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly run: {
      readonly workspaceId: string;
      readonly runId: string;
      readonly attempt: number;
    },
  ) {}

  wornToward(url: string, secrets: readonly string[]): Promise<WornSecrets> {
    return this.injection.forRun({
      workspaceId: this.run.workspaceId,
      runId: this.run.runId,
      attempt: this.run.attempt,
      secrets,
      url,
    });
  }
}
