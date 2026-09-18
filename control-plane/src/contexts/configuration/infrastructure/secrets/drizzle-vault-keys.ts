import type {
  VaultKeyLookup,
  VaultKeysPort,
} from '@configuration/application/ports/vault-keys.port';
import { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { teamVaultKey } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  type SecretCipher,
  UnopenedSecretError,
} from '@platform/secrets/secret.cipher';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { eq } from 'drizzle-orm';

export class DrizzleVaultKeys implements VaultKeysPort {
  constructor(
    private readonly context: DrizzleContext,
    private readonly cipher: SecretCipher,
  ) {}

  async of(teamId: TeamId): Promise<VaultKeyLookup> {
    const [found] = await this.context.db
      .select({ sealedKey: teamVaultKey.sealedKey })
      .from(teamVaultKey)
      .where(eq(teamVaultKey.teamId, teamId.value))
      .limit(1);

    if (!found) {
      return { kind: 'none' };
    }

    try {
      return {
        kind: 'held',
        key: VaultKey.of(this.cipher.open(found.sealedKey)),
      };
    } catch (error) {
      if (error instanceof UnopenedSecretError) {
        return { kind: 'unreadable' };
      }
      throw error;
    }
  }

  async keepFirst(teamId: TeamId, key: VaultKey): Promise<VaultKeyLookup> {
    await this.context.db
      .insert(teamVaultKey)
      .values({ teamId: teamId.value, sealedKey: this.cipher.seal(key.value) })
      .onConflictDoNothing({ target: teamVaultKey.teamId });

    const kept = await this.of(teamId);

    if (kept.kind === 'none') {
      throw new Error(`No vault key could be kept for team ${teamId.value}`);
    }

    return kept;
  }
}
