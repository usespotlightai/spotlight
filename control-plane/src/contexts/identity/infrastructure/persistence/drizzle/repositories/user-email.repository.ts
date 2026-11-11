import { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import { EmailAlreadyAddedError } from '@identity/domain/exceptions/email-already-added.error';
import { EmailInUseError } from '@identity/domain/exceptions/email-in-use.error';
import { UserEmailVersionConflictError } from '@identity/domain/exceptions/user-email-version-conflict.error';
import type { UserEmailRepository } from '@identity/domain/repositories/user-email.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { userEmail } from '@identity/infrastructure/persistence/drizzle/schemas/user-email.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, count, eq, type SQL, sql } from 'drizzle-orm';

type Row = typeof userEmail.$inferSelect;

@Injectable()
export class DrizzleUserEmailRepository implements UserEmailRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: UserEmail): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db
          .insert(userEmail)
          .values({ ...this.written(added), version: added.version });
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'user_email_user_email')) {
          throw new EmailAlreadyAddedError(added.email.value);
        }
        throw error;
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: UserEmail): Promise<void> {
    await this.context.inTransaction(async () => {
      const { id, userId, email, ...rest } = this.written(saved);
      let written: { id: string }[];

      try {
        written = await this.context.db
          .update(userEmail)
          .set({ ...rest, version: saved.version + 1 })
          .where(
            and(eq(userEmail.id, id), eq(userEmail.version, saved.version)),
          )
          .returning({ id: userEmail.id });
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'user_email_verified_email')) {
          throw new EmailInUseError(saved.email.value);
        }
        throw error;
      }

      if (written.length === 0) {
        throw new UserEmailVersionConflictError(id);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async remove(removed: UserEmail): Promise<void> {
    await this.context.inTransaction(async () => {
      const deleted = await this.context.db
        .delete(userEmail)
        .where(
          and(
            eq(userEmail.id, removed.id.value),
            eq(userEmail.version, removed.version),
          ),
        )
        .returning({ id: userEmail.id });

      if (deleted.length === 0) {
        throw new UserEmailVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async countOfUser(userId: UserId): Promise<number> {
    const [counted] = await this.context.db
      .select({ count: count() })
      .from(userEmail)
      .where(eq(userEmail.userId, userId.value));

    return counted?.count ?? 0;
  }

  async ofUser(userId: UserId, id: UserEmailId): Promise<UserEmail | null> {
    return this.first(
      and(eq(userEmail.userId, userId.value), eq(userEmail.id, id.value)),
    );
  }

  async ofUserByAddress(
    userId: UserId,
    email: EmailAddress,
  ): Promise<UserEmail | null> {
    return this.first(
      and(
        eq(userEmail.userId, userId.value),
        sql`lower(${userEmail.email}) = ${email.value}`,
      ),
    );
  }

  async withToken(hash: TokenHash): Promise<UserEmail | null> {
    return this.first(eq(userEmail.tokenHash, hash.value));
  }

  private async first(condition: SQL | undefined): Promise<UserEmail | null> {
    const [found] = await this.context.db
      .select()
      .from(userEmail)
      .where(condition)
      .limit(1);

    return found ? this.rehydrated(found) : null;
  }

  private written(email: UserEmail) {
    return {
      id: email.id.value,
      userId: email.userId.value,
      email: email.email.value,
      tokenHash: email.tokenHash.value,
      addedAt: email.addedAt,
      sentAt: email.sentAt,
      expiresAt: email.expiresAt,
      verifiedAt: email.verifiedAt,
    };
  }

  private rehydrated(row: Row): UserEmail {
    return UserEmail.rehydrate({
      id: UserEmailId.of(row.id),
      userId: UserId.of(row.userId),
      email: EmailAddress.of(row.email),
      tokenHash: TokenHash.of(row.tokenHash),
      addedAt: row.addedAt,
      sentAt: row.sentAt,
      expiresAt: row.expiresAt,
      verifiedAt: row.verifiedAt,
      version: row.version,
    });
  }
}
