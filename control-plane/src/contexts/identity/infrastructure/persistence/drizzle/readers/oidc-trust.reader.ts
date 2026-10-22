import type { OidcTrustSummaryDto } from '@identity/application/dto/oidc-trust-summary.dto';
import type { OidcTrustReaderPort } from '@identity/application/ports/oidc-trust-reader.port';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import {
  oidcTrust,
  oidcTrustUsage,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleOidcTrustReader implements OidcTrustReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listIn(workspaceId: WorkspaceId): Promise<OidcTrustSummaryDto[]> {
    const rows = await this.db
      .select({
        trust: oidcTrust,
        creatorName: user.name,
        lastIssuedAt: oidcTrustUsage.lastIssuedAt,
      })
      .from(oidcTrust)
      .leftJoin(user, eq(user.id, oidcTrust.createdBy))
      .leftJoin(oidcTrustUsage, eq(oidcTrustUsage.trustId, oidcTrust.id))
      .where(eq(oidcTrust.workspaceId, workspaceId.value))
      .orderBy(asc(oidcTrust.key));

    return rows.map(({ trust, creatorName, lastIssuedAt }) => ({
      id: trust.id,
      key: trust.key,
      issuer: trust.issuer,
      audience: trust.audience,
      subject: trust.subject,
      claims: trust.claims,
      scopes: trust.scopes,
      lifetimeMinutes: trust.lifetimeMinutes,
      createdBy: { id: trust.createdBy, name: creatorName },
      createdAt: trust.createdAt,
      lastIssuedAt,
    }));
  }
}
