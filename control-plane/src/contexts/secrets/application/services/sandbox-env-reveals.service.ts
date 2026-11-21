import { Credential } from '@secrets/application/contracts/credential.contract';
import type { DeniedSecret } from '@secrets/application/contracts/run-secret-fetch.contract';
import type {
  RevealedSandboxEnv,
  RevealedVariable,
  SandboxEnvReveal,
} from '@secrets/application/contracts/sandbox-env.contract';
import type { SandboxEnvRevealsPort } from '@secrets/application/ports/sandbox-env-reveals.port';
import type { SecretStorePort } from '@secrets/application/ports/secret-store.port';
import { deniedFor } from '@secrets/application/services/denied-secrets';
import { storedValueOf } from '@secrets/application/services/stored-value';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SandboxEnvReveals implements SandboxEnvRevealsPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly store: SecretStorePort,
    private readonly logger: LoggerPort,
  ) {}

  async reveal(request: SandboxEnvReveal): Promise<RevealedSandboxEnv> {
    const workspaceId = WorkspaceId.of(request.workspaceId);
    const variables: RevealedVariable[] = [];
    const denied: DeniedSecret[] = [];

    for (const { variable, secret: name } of request.sandboxEnv) {
      try {
        const secret = await this.secrets.named(
          workspaceId,
          SecretName.of(name),
        );

        if (!secret) {
          throw new NoSuchSecretError(name);
        }

        secret.assertAllowsSandbox();

        variables.push({
          name: variable,
          value: Credential.of(
            secret
              .sandboxValue(await storedValueOf(this.store, secret))
              .revealed(),
          ),
        });
      } catch (error) {
        denied.push(deniedFor(name, error));
      }
    }

    if (variables.length > 0) {
      this.logger.info(
        {
          workspaceId: request.workspaceId,
          runId: request.runId,
          secrets: request.sandboxEnv
            .filter((each) =>
              variables.some((revealed) => revealed.name === each.variable),
            )
            .map((each) => each.secret),
        },
        'Revealed secrets to the sandbox of a run',
      );
    }

    return { variables, denied };
  }
}
