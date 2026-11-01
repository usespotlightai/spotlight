import type {
  DeniedSecret,
  FetchedSecret,
  FetchedSecrets,
} from '@secrets/application/contracts/run-secret-fetch.contract';
import type {
  CallSecretFetch,
  CallSecretFetchesPort,
} from '@secrets/application/ports/call-secret-fetches.port';
import type {
  RunSealingPort,
  SealingRecipient,
} from '@secrets/application/ports/run-sealing.port';
import { deniedFor } from '@secrets/application/services/denied-secrets';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CallSecretFetches implements CallSecretFetchesPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly sources: SecretSources,
    private readonly sealing: RunSealingPort,
    private readonly logger: LoggerPort,
  ) {}

  async sealedForCall(request: CallSecretFetch): Promise<FetchedSecrets> {
    const recipient = this.sealing.recipientOf(request.recipient);
    const workspaceId = WorkspaceId.of(request.workspaceId);
    const secrets: FetchedSecret[] = [];
    const denied: DeniedSecret[] = [];

    for (const name of new Set(request.secrets)) {
      try {
        const secret = await this.secrets.named(
          workspaceId,
          SecretName.of(name),
        );

        if (!secret) {
          throw new NoSuchSecretError(name);
        }

        secrets.push(
          ...(await this.fetched(secret, recipient, request.callId)),
        );
      } catch (error) {
        denied.push(deniedFor(name, error));
      }
    }

    this.logger.info(
      {
        workspaceId: request.workspaceId,
        callId: request.callId,
        fetched: [...new Set(secrets.map((each) => each.secret))],
        denied: denied.map((each) => each.secret),
      },
      'sealed the secrets of a network call to its egress',
    );

    return { secrets, denied };
  }

  private async fetched(
    secret: Secret,
    recipient: SealingRecipient,
    callId: string,
  ): Promise<readonly FetchedSecret[]> {
    const bindings = secret.injectedBindings();
    const externalRef = secret.source.externalRef;
    const value: SecretValue | null = externalRef
      ? null
      : secret.injectable(await this.sources.read(secret));

    return bindings.map((binding) => ({
      secret: secret.name.value,
      host: binding.host,
      location: binding.target.location,
      name: binding.target.name,
      prefix: binding.prefix,
      sealed: value
        ? this.sealing.seal(value, recipient, {
            runId: callId,
            secretName: secret.name.value,
          })
        : null,
      externalRef: externalRef ?? null,
    }));
  }
}
