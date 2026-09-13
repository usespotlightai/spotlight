import type {
  VaultKeyLookup,
  VaultKeyRepository,
} from '@domain/repositories/vault-key.repository';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { VaultKey } from '@domain/value-objects/vault-key.vo';
import type { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { teamVaultKey } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
  type SecretCipher,
  UnopenedSecretError,
} from '@infrastructure/secrets/secret.cipher';
import { eq } from 'drizzle-orm';

export class DrizzleVaultKeys implements VaultKeyRepository {
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
