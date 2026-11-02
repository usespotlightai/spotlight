import type {
  UserEmailReaderPort,
  UserEmailSummary,
} from '@identity/application/ports/user-email-reader.port';
import { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import { userEmail } from '@identity/infrastructure/persistence/drizzle/schemas/user-email.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleUserEmailReader implements UserEmailReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async ofUser(
    userId: UserId,
    now: Date,
  ): Promise<readonly UserEmailSummary[]> {
    const rows = await this.db
      .select()
      .from(userEmail)
      .where(eq(userEmail.userId, userId.value))
      .orderBy(asc(userEmail.addedAt));

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      status: UserEmail.statusOf(row, now),
      addedAt: row.addedAt,
      sentAt: row.sentAt,
    }));
  }
}
