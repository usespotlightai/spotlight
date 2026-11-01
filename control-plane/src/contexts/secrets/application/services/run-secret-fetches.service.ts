import type {
  DeniedSecret,
  FetchedSecret,
  FetchedSecrets,
  RunSecretFetch,
} from '@secrets/application/contracts/run-secret-fetch.contract';
import type {
  RunSealingPort,
  SealingRecipient,
} from '@secrets/application/ports/run-sealing.port';
import type {
  RunSealed,
  RunSecretFetchesPort,
} from '@secrets/application/ports/run-secret-fetches.port';
import { deniedFor } from '@secrets/application/services/denied-secrets';
import type { RunGrantsUnitOfWork } from '@secrets/application/services/run-grants-unit-of-work';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { Recipient } from '@secrets/domain/value-objects/recipient.vo';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import { SecretFetcher } from '@secrets/domain/value-objects/secret-fetcher.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Granting {
  readonly secret: Secret;
  readonly grants: readonly SecretGrant[];
}

export class RunSecretFetches implements RunSecretFetchesPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly unitOfWork: RunGrantsUnitOfWork,
    private readonly sources: SecretSources,
    private readonly sealing: RunSealingPort,
  ) {}

  async fetchSecrets(request: RunSecretFetch): Promise<FetchedSecrets> {
    const recipient = this.sealing.recipientOf(request.recipient);
    const workspaceId = WorkspaceId.of(request.workspaceId);
    const runId = RunId.of(request.runId);
    const lease = RunLease.of(runId, request.attempt);
    const granting: Granting[] = [];
    const denied: DeniedSecret[] = [];

    for (const name of new Set(request.injectedSecrets)) {
      try {
        const secret = await this.secrets.named(
          workspaceId,
          SecretName.of(name),
        );

        if (!secret) {
          throw new NoSuchSecretError(name);
        }

        granting.push({ secret, grants: secret.grantTo(runId) });
      } catch (error) {
        denied.push(deniedFor(name, error));
      }
    }

    await this.unitOfWork.changed({ lease, workspaceId }, (current) =>
      current
        .grant(
          lease,
          granting.flatMap((each) => each.grants),
        )
        .recordFetch(
          lease,
          SecretFetcher.of(Recipient.of(recipient.key), request.sharedEgress),
        ),
    );

    const secrets: FetchedSecret[] = [];

    for (const { secret, grants } of granting) {
      try {
        const sealed: FetchedSecret[] = [];

        for (const grant of grants) {
          sealed.push(await this.fetched(secret, grant, recipient, runId));
        }

        secrets.push(...sealed);
      } catch (error) {
        denied.push(deniedFor(secret.name.value, error));
      }
    }

    return { secrets, denied };
  }

  sealedFor(sealed: RunSealed): string {
    return this.sealing.seal(
      SecretValue.of(sealed.value),
      this.sealing.recipientOf(sealed.recipient),
      { runId: sealed.runId, secretName: sealed.name },
    );
  }

  private async fetched(
    secret: Secret,
    grant: SecretGrant,
    recipient: SealingRecipient,
    runId: RunId,
  ): Promise<FetchedSecret> {
    const binding = secret.bindingFor(grant);
    const injection = {
      secret: secret.name.value,
      host: binding.host,
      location: binding.target.location,
      name: binding.target.name,
      prefix: binding.prefix,
    };
    const externalRef = secret.source.externalRef;

    if (externalRef) {
      return { ...injection, sealed: null, externalRef };
    }

    return {
      ...injection,
      sealed: this.sealing.seal(
        secret.injectable(await this.sources.read(secret)),
        recipient,
        { runId: runId.value, secretName: secret.name.value },
      ),
      externalRef: null,
    };
  }
}
