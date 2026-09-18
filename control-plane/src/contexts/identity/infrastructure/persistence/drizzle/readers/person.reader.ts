import type {
  PersonReaderPort,
  PersonSummary,
} from '@identity/application/ports/person-reader.port';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { eq, inArray } from 'drizzle-orm';

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

  async findMany(
    ids: readonly UserId[],
  ): Promise<ReadonlyMap<string, PersonSummary>> {
    const asked = [...new Set(ids.map((each) => each.value))];

    if (asked.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(inArray(user.id, asked));

    return new Map(rows.map((each) => [each.id, each]));
  }
}
