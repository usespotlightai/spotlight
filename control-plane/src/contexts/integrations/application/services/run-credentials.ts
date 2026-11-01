import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
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

  injectedFor(
    url: string,
    secrets: readonly string[],
  ): Promise<InjectedSecrets> {
    return this.injection.forRun({
      workspaceId: this.run.workspaceId,
      runId: this.run.runId,
      attempt: this.run.attempt,
      secrets,
      url,
    });
  }

  standInsFor(
    url: string,
    secrets: readonly string[],
  ): Promise<InjectedSecrets> {
    return this.injection.standInsForRun({
      workspaceId: this.run.workspaceId,
      runId: this.run.runId,
      attempt: this.run.attempt,
      secrets,
      url,
    });
  }
}
