import type {
  ChangedBy,
  ConfigurationChangeDto,
} from '@identity/application/dto/configuration-change.dto';
import type {
  AuditPage,
  ConfigurationAuditPort,
} from '@identity/application/ports/configuration-audit.port';
import { configurationChange } from '@identity/infrastructure/persistence/drizzle/schemas/configuration-change.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type {
  ConfigurationAction,
  ConfigurationChange,
  ConfiguredResource,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, lt } from 'drizzle-orm';

type Row = typeof configurationChange.$inferSelect;

const actorColumns = (actor: Actor | null) => {
  if (!actor) {
    return {
      actor: 'spotlight',
      userId: null,
      tokenId: null,
      trustId: null,
      client: null,
    };
  }

  const { principal } = actor;

  return {
    actor: principal.kind,
    userId: principal.userId.value,
    tokenId: principal.kind === 'token' ? principal.tokenId.value : null,
    trustId:
      principal.kind === 'token'
        ? (principal.issuedByTrustId?.value ?? null)
        : null,
    client: actor.client.toString(),
  };
};

const changedBy = (row: Row): ChangedBy => {
  if (row.actor === 'token' && row.tokenId && row.userId) {
    return {
      kind: 'token',
      tokenId: row.tokenId,
      userId: row.userId,
      trust: row.trustId,
    };
  }

  if (row.actor === 'person' && row.userId) {
    return { kind: 'person', userId: row.userId };
  }

  return { kind: 'spotlight' };
};

@Injectable()
export class DrizzleConfigurationAudit implements ConfigurationAuditPort {
  constructor(private readonly context: DrizzleContext) {}

  async record(change: ConfigurationChange): Promise<void> {
    await this.context.db.insert(configurationChange).values({
      workspaceId: change.by.workspaceId.value,
      resource: change.resource,
      resourceId: change.resourceId,
      key: change.key,
      action: change.action,
      details: change.recordedDetail,
      ...actorColumns(change.by.actor),
    });
  }

  async changesIn(
    workspaceId: WorkspaceId,
    page: AuditPage,
  ): Promise<readonly ConfigurationChangeDto[]> {
    const rows = await this.context.db
      .select()
      .from(configurationChange)
      .where(
        and(
          eq(configurationChange.workspaceId, workspaceId.value),
          page.before === null
            ? undefined
            : lt(configurationChange.seq, page.before),
        ),
      )
      .orderBy(desc(configurationChange.seq))
      .limit(page.limit);

    return rows.map((row) => ({
      seq: row.seq,
      resource: row.resource as ConfiguredResource,
      resourceId: row.resourceId,
      key: row.key,
      action: row.action as ConfigurationAction,
      by: changedBy(row),
      client: row.client,
      details: row.details,
      at: row.recordedAt,
    }));
  }
}
