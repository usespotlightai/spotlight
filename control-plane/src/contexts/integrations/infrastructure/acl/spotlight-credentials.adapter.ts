import type {
  CallCredentialsPort,
  RunOfCall,
} from '@integrations/application/ports/call-credentials.port';
import type {
  Credentials,
  SigningSecrets,
} from '@integrations/application/ports/integration-runtime.port';
import type { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import type { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SpotlightCredentials implements Credentials {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly workspaceOf: () => Promise<WorkspaceId>,
  ) {}

  async injectedFor(
    url: string,
    secrets: readonly SecretName[],
  ): Promise<InjectedSecrets> {
    return this.injection.forSpotlight({
      workspaceId: (await this.workspaceOf()).value,
      secrets: secrets.map((each) => each.value),
      url,
    });
  }

  async standInsFor(
    url: string,
    secrets: readonly SecretName[],
  ): Promise<InjectedSecrets> {
    return this.injection.standInsFor({
      workspaceId: (await this.workspaceOf()).value,
      secrets: secrets.map((each) => each.value),
      url,
    });
  }
}

class RunCredentials implements Credentials {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly run: RunOfCall,
  ) {}

  injectedFor(
    url: string,
    secrets: readonly SecretName[],
  ): Promise<InjectedSecrets> {
    return this.injection.forRun({
      workspaceId: this.run.workspaceId.value,
      runId: this.run.run.runId.value,
      attempt: this.run.run.attempt,
      secrets: secrets.map((each) => each.value),
      url,
    });
  }

  standInsFor(
    url: string,
    secrets: readonly SecretName[],
  ): Promise<InjectedSecrets> {
    return this.injection.standInsForRun({
      workspaceId: this.run.workspaceId.value,
      runId: this.run.run.runId.value,
      attempt: this.run.run.attempt,
      secrets: secrets.map((each) => each.value),
      url,
    });
  }
}

export class SpotlightSigningSecrets implements SigningSecrets {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly workspaceId: WorkspaceId,
  ) {}

  named(secret: SecretName): Promise<VerifyingSecret> {
    return this.injection.forVerifying({
      workspaceId: this.workspaceId.value,
      secret: secret.value,
    });
  }
}

export class InjectedCallCredentials implements CallCredentialsPort {
  constructor(private readonly injection: SecretInjectionPort) {}

  forSpotlight(workspaceOf: () => Promise<WorkspaceId>): Credentials {
    return new SpotlightCredentials(this.injection, workspaceOf);
  }

  forRun(run: RunOfCall): Credentials {
    return new RunCredentials(this.injection, run);
  }
}
