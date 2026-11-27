import type { HookSigningSecretsPort } from '@integrations/application/ports/hook-signing-secrets.port';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { secretLabel } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-definitions.repository';
import { hookDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  CREDENTIAL_ENCRYPTION,
  type CredentialEncryptionPort,
} from '@secrets/application/ports/credential-encryption.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { SigningSecret } from '@shared-kernel/domain/value-objects/signing-secret.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleHookSigningSecrets implements HookSigningSecretsPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(CREDENTIAL_ENCRYPTION)
    private readonly encryption: CredentialEncryptionPort,
  ) {}

  async signingSecretOf(
    hookId: HookDefinitionId,
  ): Promise<SigningSecret | null> {
    const found = firstOf(
      await this.context.db
        .select({
          workspaceId: hookDefinition.workspaceId,
          signingSecret: hookDefinition.signingSecret,
        })
        .from(hookDefinition)
        .where(eq(hookDefinition.id, hookId.value))
        .limit(1),
    );

    if (
      found === undefined ||
      found.signingSecret === null ||
      found.signingSecret === ''
    ) {
      return null;
    }

    return SigningSecret.rehydrate(
      (
        await this.encryption.decrypt(
          found.workspaceId,
          secretLabel(hookId.value),
          found.signingSecret,
        )
      ).revealed(),
    );
  }
}
