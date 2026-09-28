import { Inject, Injectable } from '@nestjs/common';
import type {
  ProvisionSecretsPort,
  SecretHolder,
} from '@runners/application/ports/provision-secrets.port';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { SealedProvisionSecret } from '@runners/domain/value-objects/sealed-provision-secret.vo';
import { Credential } from '@secrets/application/contracts/credential.contract';
import { CredentialUnopenableError } from '@secrets/application/errors/credential-unopenable.error';
import {
  CREDENTIAL_SEALING,
  type CredentialSealingPort,
} from '@secrets/application/ports/credential-sealing.port';

const labelOf = (holder: SecretHolder): string =>
  `runner-pool:${holder.id.value}:provision-secret`;

@Injectable()
export class SealedProvisionSecrets implements ProvisionSecretsPort {
  constructor(
    @Inject(CREDENTIAL_SEALING)
    private readonly sealing: CredentialSealingPort,
  ) {}

  async sealed(
    holder: SecretHolder,
    secret: ProvisionSecret,
  ): Promise<SealedProvisionSecret> {
    return SealedProvisionSecret.of(
      await this.sealing.seal(
        holder.workspaceId.value,
        labelOf(holder),
        Credential.of(secret.revealed()),
      ),
    );
  }

  async opened(
    holder: SecretHolder,
    sealed: SealedProvisionSecret,
  ): Promise<ProvisionSecret> {
    try {
      return ProvisionSecret.of(
        (
          await this.sealing.open(
            holder.workspaceId.value,
            labelOf(holder),
            sealed.value,
          )
        ).revealed(),
      );
    } catch (error) {
      if (error instanceof CredentialUnopenableError) {
        throw new ProvisionSecretUnopenableError(holder.id.value);
      }

      throw error;
    }
  }
}
