import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { TokenTrustAlreadyDefinedError } from '@identity/domain/exceptions/token-trust-already-defined.error';
import { TokenTrustMovedOnError } from '@identity/domain/exceptions/token-trust-moved-on.error';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { workspaceTokenTrust } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
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
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof workspaceTokenTrust.$inferSelect;

const toTrust = (row: Row): WorkspaceTokenTrust =>
  WorkspaceTokenTrust.rehydrate({
    id: WorkspaceTokenTrustId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: TokenTrustKey.of(row.key),
    workload: WorkloadRule.of({
      issuer: row.issuer,
      audience: row.audience,
      subject: row.subject,
      claims: row.claims,
    }),
    scopes: TokenScopes.named(row.scopes),
    lifetime: TokenLifetime.ofMinutes(row.lifetimeMinutes),
    definedBy: UserId.of(row.definedBy),
    version: row.version,
  });

const termsOf = (trust: WorkspaceTokenTrust) => ({
  issuer: trust.workload.issuer,
  audience: trust.workload.audience,
  subject: trust.workload.subject.value,
  claims: { ...trust.workload.claims },
  scopes: trust.scopes.all.map((each) => each.value),
  lifetimeMinutes: trust.lifetime.minutes,
});

@Injectable()
export class DrizzleWorkspaceTokenTrustRepository
  implements WorkspaceTokenTrustRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: WorkspaceTokenTrust): Promise<void> {
    await this.context.run(async () => {
      try {
        await this.context.db.insert(workspaceTokenTrust).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          key: added.key.value,
          ...termsOf(added),
          definedBy: added.definedBy.value,
          version: added.version,
        });
      } catch (error) {
        if (
          violates(
            error,
            UNIQUE_VIOLATION,
            'workspace_token_trust_workspace_key',
          )
        ) {
          throw new TokenTrustAlreadyDefinedError(added.key.value);
        }

        if (codeOf(error) === FOREIGN_KEY_VIOLATION) {
          throw new NoSuchWorkspaceError(added.workspaceId.value);
        }

        throw error;
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: WorkspaceTokenTrust): Promise<void> {
    await this.context.run(async () => {
      const matching = and(
        eq(workspaceTokenTrust.id, saved.id.value),
        eq(workspaceTokenTrust.version, saved.version),
      );
      const written = saved.isWithdrawn
        ? await this.context.db
            .delete(workspaceTokenTrust)
            .where(matching)
            .returning({ id: workspaceTokenTrust.id })
        : await this.context.db
            .update(workspaceTokenTrust)
            .set({ ...termsOf(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: workspaceTokenTrust.id });

      if (written.length === 0) {
        throw new TokenTrustMovedOnError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: WorkspaceTokenTrustId): Promise<WorkspaceTokenTrust | null> {
    const [found] = await this.context.db
      .select()
      .from(workspaceTokenTrust)
      .where(eq(workspaceTokenTrust.id, id.value))
      .limit(1);

    return found ? toTrust(found) : null;
  }

  async holding(
    id: WorkspaceTokenTrustId,
  ): Promise<WorkspaceTokenTrust | null> {
    const [found] = await this.context.db
      .select()
      .from(workspaceTokenTrust)
      .where(eq(workspaceTokenTrust.id, id.value))
      .for('share')
      .limit(1);

    return found ? toTrust(found) : null;
  }
}
