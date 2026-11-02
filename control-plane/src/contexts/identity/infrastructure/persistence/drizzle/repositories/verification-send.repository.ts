import { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import type { VerificationSendRepository } from '@identity/domain/repositories/verification-send.repository';
import { verificationSend } from '@identity/infrastructure/persistence/drizzle/schemas/user-email.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, count, eq, gte, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleVerificationSendRepository
  implements VerificationSendRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async countOfUserSince(userId: UserId, since: Date): Promise<number> {
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
