import type { SigningSecrets } from '@integrations/application/ports/integration-runtime.port';
import type { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SpotlightSigningSecrets implements SigningSecrets {
  constructor(
    private readonly injection: SecretInjectionPort,
    private readonly workspaceId: WorkspaceId,
  ) {}

  named(secret: string): Promise<VerifyingSecret> {
    return this.injection.forVerifying({
      workspaceId: this.workspaceId.value,
      secret,
    });
  }
}
