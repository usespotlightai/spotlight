import type { HookSigningSecretsPort } from '@integrations/application/ports/hook-signing-secrets.port';
import { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';
import { secretLabel } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-definitions.repository';
import { hookDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  CREDENTIAL_ENCRYPTION,
  type CredentialEncryptionPort,
} from '@secrets/application/ports/credential-encryption.port';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleHookSigningSecrets implements HookSigningSecretsPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(CREDENTIAL_ENCRYPTION)
    private readonly encryption: CredentialEncryptionPort,
  ) {}

  async signingSecretOf(hookId: string): Promise<HookSigningSecret | null> {
    const [found] = await this.context.db
      .select({
        workspaceId: hookDefinition.workspaceId,
        signingSecret: hookDefinition.signingSecret,
      })
      .from(hookDefinition)
      .where(eq(hookDefinition.id, hookId))
      .limit(1);

    if (!found?.signingSecret) {
      return null;
    }

    return HookSigningSecret.of(
      (
        await this.encryption.decrypt(
          found.workspaceId,
          secretLabel(hookId),
          found.signingSecret,
        )
      ).revealed(),
    );
  }
}
