import type {
  PersonReaderPort,
  PersonSummary,
} from '@application/ports/person-reader.port';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzlePersonReader implements PersonReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async find(id: UserId): Promise<PersonSummary | null> {
    const [found] = await this.db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(eq(user.id, id.value))
      .limit(1);

    return found ?? null;
  }
}
