import type { EmailOwnersPort } from '@identity/application/ports/email-owners.port';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { userEmail } from '@identity/infrastructure/persistence/drizzle/schemas/user-email.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, isNotNull, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleEmailOwners implements EmailOwnersPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async ownerOf(email: EmailAddress): Promise<UserId | null> {
    const [signsIn] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${email.value}`)
      .limit(1);

    if (signsIn) {
      return UserId.of(signsIn.id);
    }

    const [verified] = await this.db
      .select({ id: userEmail.userId })
      .from(userEmail)
      .where(
        and(
          sql`lower(${userEmail.email}) = ${email.value}`,
          isNotNull(userEmail.verifiedAt),
        ),
      )
      .limit(1);

    return verified ? UserId.of(verified.id) : null;
  }
}
