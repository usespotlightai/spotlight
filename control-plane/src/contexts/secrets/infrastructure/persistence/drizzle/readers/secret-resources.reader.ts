import type { WorkspaceDependentSource } from '@identity/application/ports/workspace-dependents.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DefinedSecretsPort } from '@secrets/application/ports/defined-secrets.port';
import type {
  SecretRecord,
  SecretResourcesPort,
} from '@secrets/application/ports/secret-resources.port';
import type { SecretSourceKind } from '@secrets/domain/value-objects/secret-source.vo';
import { secret } from '@secrets/infrastructure/persistence/drizzle/schemas/secret.schema';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, type SQL } from 'drizzle-orm';

const recordOf = (row: typeof secret.$inferSelect): SecretRecord => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  name: row.name,
  source: {
    kind: row.source as SecretSourceKind,
    secretId: row.sourceSecretId,
    field: row.sourceField,
  },
  bindings: row.bindings.map((each) => ({ ...each })),
  valueVersion: row.valueVersion,
  rotatedAt: row.rotatedAt,
});

@Injectable()
export class DrizzleSecretResources
  implements SecretResourcesPort, DefinedSecretsPort, WorkspaceDependentSource
{
  constructor(private readonly context: DrizzleContext) {}

  withId(id: string): Promise<SecretRecord | null> {
    return this.first(eq(secret.id, id));
  }

  named(workspaceId: WorkspaceId, name: string): Promise<SecretRecord | null> {
    return this.first(
      and(eq(secret.workspaceId, workspaceId.value), eq(secret.name, name)),
    );
  }

  async secretsIn(workspaceId: WorkspaceId): Promise<readonly SecretRecord[]> {
    return (
      await this.context.db
        .select()
        .from(secret)
        .where(eq(secret.workspaceId, workspaceId.value))
    ).map(recordOf);
  }

  async namesIn(workspaceId: string): Promise<readonly string[]> {
    return (
      await this.context.db
        .select({ name: secret.name })
        .from(secret)
        .where(eq(secret.workspaceId, workspaceId))
        .orderBy(asc(secret.name))
    ).map((each) => each.name);
  }

  async dependentsOf(workspaceId: WorkspaceId): Promise<readonly string[]> {
    return (await this.namesIn(workspaceId.value)).map(
      (name) => `secret ${name}`,
    );
  }

  private async first(where: SQL | undefined): Promise<SecretRecord | null> {
    const [found] = await this.context.db
      .select()
      .from(secret)
      .where(where)
      .limit(1);

    return found ? recordOf(found) : null;
  }
}
