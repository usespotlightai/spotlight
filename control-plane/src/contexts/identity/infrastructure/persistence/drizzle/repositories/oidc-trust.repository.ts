import { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { OidcTrustAlreadyExistsError } from '@identity/domain/exceptions/oidc-trust-already-exists.error';
import { OidcTrustVersionConflictError } from '@identity/domain/exceptions/oidc-trust-version-conflict.error';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { oidcTrust } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  codeOf,
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof oidcTrust.$inferSelect;

const toTrust = (row: Row): OidcTrust =>
  OidcTrust.rehydrate({
    id: OidcTrustId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: OidcTrustKey.of(row.key),
    workload: WorkloadRule.of({
      issuer: row.issuer,
      audience: row.audience,
      subject: row.subject,
      claims: row.claims,
    }),
    scopes: TokenScopes.named(row.scopes),
    lifetime: TokenLifetime.ofMinutes(row.lifetimeMinutes),
    createdBy: UserId.of(row.createdBy),
    createdAt: row.createdAt,
    version: row.version,
  });

const specOf = (trust: OidcTrust) => ({
  issuer: trust.workload.issuer,
  audience: trust.workload.audience,
  subject: trust.workload.subject.value,
  claims: { ...trust.workload.claims },
  scopes: trust.scopes.all.map((each) => each.value),
  lifetimeMinutes: trust.lifetime.minutes,
});

@Injectable()
export class DrizzleOidcTrustRepository implements OidcTrustRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: OidcTrust): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(oidcTrust).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          key: added.key.value,
          ...specOf(added),
          createdBy: added.createdBy.value,
          createdAt: added.createdAt,
          version: added.version,
        });
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'oidc_trust_workspace_key')) {
          throw new OidcTrustAlreadyExistsError(added.key.value);
        }

        if (codeOf(error) === FOREIGN_KEY_VIOLATION) {
          throw new NoSuchWorkspaceError(added.workspaceId.value);
        }

        throw error;
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: OidcTrust): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(oidcTrust.id, saved.id.value),
        eq(oidcTrust.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(oidcTrust)
            .where(matching)
            .returning({ id: oidcTrust.id })
        : await this.context.db
            .update(oidcTrust)
            .set({ ...specOf(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: oidcTrust.id });

      if (written.length === 0) {
        throw new OidcTrustVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: OidcTrustId): Promise<OidcTrust | null> {
    const [found] = await this.context.db
      .select()
      .from(oidcTrust)
      .where(eq(oidcTrust.id, id.value))
      .limit(1);

    return found ? toTrust(found) : null;
  }

  async findLocked(id: OidcTrustId): Promise<OidcTrust | null> {
    const [found] = await this.context.db
      .select()
      .from(oidcTrust)
      .where(eq(oidcTrust.id, id.value))
      .for('share')
      .limit(1);

    return found ? toTrust(found) : null;
  }
}
