import type {
  SecretSummary,
  TeamSecretsPort,
} from '@application/ports/team-secrets.port';
import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { SecretValue } from '@domain/value-objects/secret-value.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { teamSecret } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import type { SecretCipher } from '@infrastructure/secrets/secret.cipher';
import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTeamSecrets implements TeamSecretsPort {
  constructor(
    private readonly context: DrizzleContext,
    private readonly cipher: SecretCipher,
  ) {}

  async set(
    teamId: TeamId,
    name: SecretName,
    value: SecretValue,
  ): Promise<void> {
    // Sealed before it is anywhere near the statement, so nothing that logs
    // a query ever has the secret to log.
    const sealed = this.cipher.seal(value.value);

    await this.context.db
      .insert(teamSecret)
      .values({ teamId: teamId.value, name: name.value, sealed })
      .onConflictDoUpdate({
        target: [teamSecret.teamId, teamSecret.name],
        set: { sealed, setAt: new Date() },
      });
  }

  async resolve(teamId: TeamId, name: SecretName): Promise<string | null> {
    const [found] = await this.context.db
      .select({ sealed: teamSecret.sealed })
      .from(teamSecret)
      .where(
        and(
          eq(teamSecret.teamId, teamId.value),
          eq(teamSecret.name, name.value),
        ),
      )
      .limit(1);

    return found ? this.cipher.open(found.sealed) : null;
  }

  async held(teamId: TeamId): Promise<readonly SecretSummary[]> {
    const held = await this.context.db
      .select({ name: teamSecret.name, setAt: teamSecret.setAt })
      .from(teamSecret)
      .where(eq(teamSecret.teamId, teamId.value))
      .orderBy(asc(teamSecret.name));

    return held.map((each) => ({ name: each.name, setAt: each.setAt }));
  }

  async forget(teamId: TeamId, name: SecretName): Promise<void> {
    await this.context.db
      .delete(teamSecret)
      .where(
        and(
          eq(teamSecret.teamId, teamId.value),
          eq(teamSecret.name, name.value),
        ),
      );
  }
}
