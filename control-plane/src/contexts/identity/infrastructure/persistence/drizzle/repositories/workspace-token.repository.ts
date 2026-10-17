import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { WorkspaceTokenAlreadyIssuedError } from '@identity/domain/exceptions/workspace-token-already-issued.error';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { workspaceToken } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  codeOf,
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { and, eq, isNotNull, lte, or, type SQL } from 'drizzle-orm';

type Row = typeof workspaceToken.$inferSelect;

const rehydrated = (row: Row): WorkspaceToken =>
  WorkspaceToken.rehydrate({
    id: WorkspaceTokenId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    name: TokenName.of(row.name),
    description: TokenDescription.of(row.description),
    scopes: TokenScopes.named(row.scopes),
    hash: TokenHash.of(row.tokenHash),
    issuedBy: UserId.of(row.issuedBy),
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    mintedThrough:
      row.mintedThrough === null
        ? null
        : WorkspaceTokenTrustId.of(row.mintedThrough),
    mintedUnder: row.mintedUnder,
    mintedForRun: row.mintedForRun === null ? null : RunId.of(row.mintedForRun),
    mintedForAttempt: row.mintedForAttempt,
    version: row.version,
  });

@Injectable()
export class DrizzleWorkspaceTokenRepository
  implements WorkspaceTokenRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: WorkspaceToken): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(workspaceToken).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          name: added.name.value,
          description: added.description.value,
          scopes: added.scopes.all.map((each) => each.value),
          tokenHash: added.hash.value,
          issuedBy: added.issuedBy.value,
          issuedAt: added.issuedAt,
          expiresAt: added.expiresAt,
          mintedThrough: added.mintedThrough?.value ?? null,
          mintedUnder: added.mintedUnder,
          mintedForRun: added.mintedForRun?.value ?? null,
          mintedForAttempt: added.mintedForAttempt,
        });
      } catch (error) {
        if (codeOf(error) === UNIQUE_VIOLATION) {
          throw new WorkspaceTokenAlreadyIssuedError(added.name.value);
        }

        if (codeOf(error) === FOREIGN_KEY_VIOLATION) {
          throw new NoSuchWorkspaceError(added.workspaceId.value);
        }

        throw error;
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: WorkspaceToken): Promise<void> {
    await this.context.inTransaction(async () => {
      const sameVersion = and(
        eq(workspaceToken.id, saved.id.value),
        eq(workspaceToken.version, saved.version),
      );
      const written = saved.isRevoked
        ? await this.context.db
            .delete(workspaceToken)
            .where(sameVersion)
            .returning({ id: workspaceToken.id })
        : await this.context.db
            .update(workspaceToken)
            .set({
              description: saved.description.value,
              version: saved.version + 1,
            })
            .where(sameVersion)
            .returning({ id: workspaceToken.id });

      if (written.length === 0) {
        throw new WorkspaceTokenVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  find(id: WorkspaceTokenId): Promise<WorkspaceToken | null> {
    return this.one(eq(workspaceToken.id, id.value));
  }

  bearing(hash: TokenHash): Promise<WorkspaceToken | null> {
    return this.one(eq(workspaceToken.tokenHash, hash.value));
  }

  async mintedThrough(
    trustId: WorkspaceTokenTrustId,
  ): Promise<readonly WorkspaceToken[]> {
    const rows = await this.context.db
      .select()
      .from(workspaceToken)
      .where(eq(workspaceToken.mintedThrough, trustId.value));

    return rows.map(rehydrated);
  }

  async mintedForRun(
    workspaceId: WorkspaceId,
    runId: RunId,
    attempt: number | null,
  ): Promise<readonly WorkspaceToken[]> {
    const rows = await this.context.db
      .select()
      .from(workspaceToken)
      .where(
        and(
          eq(workspaceToken.workspaceId, workspaceId.value),
          eq(workspaceToken.mintedForRun, runId.value),
          attempt === null
            ? undefined
            : eq(workspaceToken.mintedForAttempt, attempt),
        ),
      );

    return rows.map(rehydrated);
  }

  async mintedAndExpiredBy(
    now: Date,
    limit: number,
  ): Promise<readonly WorkspaceToken[]> {
    const rows = await this.context.db
      .select()
      .from(workspaceToken)
      .where(
        and(
          or(
            isNotNull(workspaceToken.mintedThrough),
            isNotNull(workspaceToken.mintedForRun),
          ),
          lte(workspaceToken.expiresAt, now),
        ),
      )
      .limit(limit);

    return rows.map(rehydrated);
  }

  private async one(where: SQL): Promise<WorkspaceToken | null> {
    const [found] = await this.context.db
      .select()
      .from(workspaceToken)
      .where(where)
      .limit(1);

    return found ? rehydrated(found) : null;
  }
}
