import type {
  Redeemed,
  RedeemedSecret,
  RunRedemption,
  WithheldSecret,
} from '@secrets/application/contracts/run-redemption.contract';
import type { RunRedemptionsPort } from '@secrets/application/ports/run-redemptions.port';
import type {
  RunSealingPort,
  SealingRecipient,
} from '@secrets/application/ports/run-sealing.port';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretUnwearableError } from '@secrets/domain/exceptions/secret-unwearable.error';
import { UnreadableSecretError } from '@secrets/domain/exceptions/unreadable-secret.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import type { SecretGrantRepository } from '@secrets/domain/repositories/secret-grant.repository';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const WITHHELD = [
  NoSuchSecretError,
  SecretNotBoundError,
  SecretUnwearableError,
  UnreadableSecretError,
];

const withheldFor = (secret: string, error: unknown): WithheldSecret => {
  if (WITHHELD.some((kind) => error instanceof kind)) {
    return { secret, reason: (error as Error).message };
  }

  throw error;
};

export class RunRedemptions implements RunRedemptionsPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly grants: SecretGrantRepository,
    private readonly sources: SecretSources,
    private readonly sealing: RunSealingPort,
  ) {}

  async redeem(redemption: RunRedemption): Promise<Redeemed> {
    const recipient = this.sealing.recipientOf(redemption.recipient);
    const workspaceId = WorkspaceId.of(redemption.workspaceId);
    const runId = RunId.of(redemption.runId);
    const secrets: RedeemedSecret[] = [];
    const withheld: WithheldSecret[] = [];

    for (const name of new Set(redemption.wears)) {
      try {
        const secret = await this.secrets.named(
          workspaceId,
          SecretName.of(name),
        );

        if (!secret) {
          throw new NoSuchSecretError(name);
        }

        const granted = secret.grantedTo(runId);
        await this.grants.grant(granted);

        for (const grant of granted) {
          secrets.push(await this.redeemed(secret, grant, recipient, runId));
        }
      } catch (error) {
        withheld.push(withheldFor(name, error));
      }
    }

    return { secrets, withheld };
  }

  private async redeemed(
    secret: Secret,
    grant: SecretGrant,
    recipient: SealingRecipient,
    runId: RunId,
  ): Promise<RedeemedSecret> {
    const binding = secret.bindingFor(grant);
    const worn = {
      secret: secret.name.value,
      host: binding.host,
      header: binding.header,
      prefix: binding.prefix,
    };
    const inNetwork = secret.source.readInNetwork;

    if (inNetwork) {
      return { ...worn, sealed: null, readInNetwork: inNetwork };
    }

    return {
      ...worn,
      sealed: this.sealing.seal(
        secret.wearable(await this.sources.read(secret)),
        recipient,
        { runId: runId.value, secretName: secret.name.value },
      ),
      readInNetwork: null,
    };
  }
}
