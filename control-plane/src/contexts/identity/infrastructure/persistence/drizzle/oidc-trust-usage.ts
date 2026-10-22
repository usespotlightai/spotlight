import type { OidcTrustUsagePort } from '@identity/application/ports/oidc-trust-usage.port';
import { oidcTrustUsage } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleOidcTrustUsage implements OidcTrustUsagePort {
  constructor(private readonly context: DrizzleContext) {}

  async issued(
    trustId: OidcTrustId,
    workspaceId: WorkspaceId,
    at: Date,
  ): Promise<void> {
    await this.context.db
      .insert(oidcTrustUsage)
      .values({
        trustId: trustId.value,
        workspaceId: workspaceId.value,
        lastIssuedAt: at,
      })
      .onConflictDoUpdate({
        target: oidcTrustUsage.trustId,
        set: {
          lastIssuedAt: sql`greatest(${oidcTrustUsage.lastIssuedAt}, excluded.last_issued_at)`,
        },
      });
  }

  async forget(trustId: OidcTrustId): Promise<void> {
    await this.context.db
      .delete(oidcTrustUsage)
      .where(eq(oidcTrustUsage.trustId, trustId.value));
  }
}
