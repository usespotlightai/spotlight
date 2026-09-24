import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { SecretGrantRepository } from '@secrets/domain/repositories/secret-grant.repository';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { secretGrant } from '@secrets/infrastructure/persistence/drizzle/schemas/secret.schema';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleSecretGrants implements SecretGrantRepository {
  constructor(private readonly context: DrizzleContext) {}

  async grant(grants: readonly SecretGrant[]): Promise<void> {
    if (grants.length === 0) {
      return;
    }

    await this.context.db
      .insert(secretGrant)
      .values(
        grants.map((each) => ({
          runId: each.runId.value,
          secretId: each.secretId.value,
          host: each.host,
          workspaceId: each.workspaceId.value,
        })),
      )
      .onConflictDoNothing({
        target: [secretGrant.runId, secretGrant.secretId, secretGrant.host],
      });
  }

  async holds(grant: SecretGrant): Promise<boolean> {
    const [held] = await this.context.db
      .select({ runId: secretGrant.runId })
      .from(secretGrant)
      .where(
        and(
          eq(secretGrant.runId, grant.runId.value),
          eq(secretGrant.secretId, grant.secretId.value),
          eq(secretGrant.host, grant.host),
          eq(secretGrant.workspaceId, grant.workspaceId.value),
        ),
      )
      .limit(1);

    return held !== undefined;
  }

  async revokeFor(runId: RunId): Promise<void> {
    await this.context.db
      .delete(secretGrant)
      .where(eq(secretGrant.runId, runId.value));
  }
}
