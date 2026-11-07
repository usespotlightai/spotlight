import type { VerificationSendsPort } from '@identity/application/ports/verification-sends.port';
import { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import { verificationSend } from '@identity/infrastructure/persistence/drizzle/schemas/user-email.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, count, eq, gte, lt, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleVerificationSends implements VerificationSendsPort {
  constructor(private readonly context: DrizzleContext) {}

  async lockAndCountSince(userId: UserId, since: Date): Promise<number> {
    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`verification-send:${userId.value}`}, 0))`,
    );

    const [counted] = await this.context.db
      .select({ count: count() })
      .from(verificationSend)
      .where(
        and(
          eq(verificationSend.userId, userId.value),
          gte(verificationSend.sentAt, since),
        ),
      );

    return counted?.count ?? 0;
  }

  async record(userId: UserId, at: Date): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(verificationSend)
        .where(
          and(
            eq(verificationSend.userId, userId.value),
            lt(verificationSend.sentAt, UserEmail.sendsCountedSince(at)),
          ),
        );
      await this.context.db
        .insert(verificationSend)
        .values({ userId: userId.value, sentAt: at });
    });
  }
}
