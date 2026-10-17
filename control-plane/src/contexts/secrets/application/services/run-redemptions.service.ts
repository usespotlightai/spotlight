import type {
  Redeemed,
  RedeemedSecret,
  RunRedemption,
  WithheldSecret,
} from '@secrets/application/contracts/run-redemption.contract';
import type {
  RunRedemptionsPort,
  RunSealed,
} from '@secrets/application/ports/run-redemptions.port';
import type {
  RunSealingPort,
  SealingRecipient,
} from '@secrets/application/ports/run-sealing.port';
import type { RunGrantsKept } from '@secrets/application/services/run-grants-kept';
import type { SecretSources } from '@secrets/application/services/secret-sources.service';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretUnwearableError } from '@secrets/domain/exceptions/secret-unwearable.error';
import { UnreadableSecretError } from '@secrets/domain/exceptions/unreadable-secret.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { Redeemer } from '@secrets/domain/value-objects/redeemer.vo';
import { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
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

interface Granting {
  readonly secret: Secret;
  readonly grants: readonly SecretGrant[];
}

export class RunRedemptions implements RunRedemptionsPort {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly kept: RunGrantsKept,
    private readonly sources: SecretSources,
    private readonly sealing: RunSealingPort,
  ) {}

  async redeem(redemption: RunRedemption): Promise<Redeemed> {
    const recipient = this.sealing.recipientOf(redemption.recipient);
    const workspaceId = WorkspaceId.of(redemption.workspaceId);
    const runId = RunId.of(redemption.runId);
    const lease = RunLease.of(runId, redemption.attempt);
    const granting: Granting[] = [];
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

        granting.push({ secret, grants: secret.grantTo(runId) });
      } catch (error) {
        withheld.push(withheldFor(name, error));
      }
    }

    await this.kept.changed({ lease, workspaceId }, (current) =>
      current
        .grant(
          lease,
          granting.flatMap((each) => each.grants),
        )
        .redeemFor(
          lease,
          Redeemer.of(
            RedemptionRecipient.of(recipient.key),
            redemption.sharedEgress,
          ),
        ),
    );

    const secrets: RedeemedSecret[] = [];

    for (const { secret, grants } of granting) {
      try {
        const sealed: RedeemedSecret[] = [];

        for (const grant of grants) {
          sealed.push(await this.redeemed(secret, grant, recipient, runId));
        }

        secrets.push(...sealed);
      } catch (error) {
        withheld.push(withheldFor(secret.name.value, error));
      }
    }

    return { secrets, withheld };
  }

  sealedFor(sealed: RunSealed): string {
    return this.sealing.seal(
      SecretValue.of(sealed.value),
      this.sealing.recipientOf(sealed.recipient),
      { runId: sealed.runId, secretName: sealed.name },
    );
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
      carrier: binding.carrier.kind,
      name: binding.carrier.name,
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
