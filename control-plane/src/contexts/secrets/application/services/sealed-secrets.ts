import type {
  DeniedSecret,
  FetchedSecret,
  FetchedSecrets,
} from '@secrets/application/contracts/run-secret-fetch.contract';
import type {
  SealingRecipient,
  SecretSealingPort,
} from '@secrets/application/ports/secret-sealing.port';
import type { SecretStorePort } from '@secrets/application/ports/secret-store.port';
import { deniedFor } from '@secrets/application/services/denied-secrets';
import { storedValueOf } from '@secrets/application/services/stored-value';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretTargets } from '@secrets/domain/value-objects/secret-targets.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SealedSecretsRequest {
  readonly workspaceId: string;
  readonly secrets: readonly string[];
  readonly recipient: string;
  readonly subject: string;
}

export class SealedSecrets {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly store: SecretStorePort,
    private readonly sealing: SecretSealingPort,
  ) {}

  async of(request: SealedSecretsRequest): Promise<FetchedSecrets> {
    const recipient = this.sealing.recipientOf(request.recipient);
    const workspaceId = WorkspaceId.of(request.workspaceId);
    const secrets: FetchedSecret[] = [];
    const denied: DeniedSecret[] = [];
    let targets = SecretTargets.none();

    for (const name of new Set(request.secrets)) {
      try {
        const secret = await this.secrets.named(
          workspaceId,
          SecretName.of(name),
        );

        if (!secret) {
          throw new NoSuchSecretError(name);
        }

        targets = targets.claim(secret.name, secret.injectedBindings());
        secrets.push(
          ...(await this.fetched(secret, recipient, request.subject)),
        );
      } catch (error) {
        denied.push(deniedFor(name, error));
      }
    }

    return { secrets, denied };
  }

  private async fetched(
    secret: Secret,
    recipient: SealingRecipient,
    subject: string,
  ): Promise<readonly FetchedSecret[]> {
    const bindings = secret.injectedBindings();
    const value = secret.injectable(await storedValueOf(this.store, secret));

    return bindings.map((binding) => ({
      secret: secret.name.value,
      host: binding.host.value,
      location: binding.target.location,
      name: binding.target.name,
      prefix: binding.prefix,
      sealed: this.sealing.seal(value, recipient, {
        subject,
        secretName: secret.name.value,
      }),
    }));
  }
}
