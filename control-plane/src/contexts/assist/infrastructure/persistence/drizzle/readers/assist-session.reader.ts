import type {
  AssistSessionReaderPort,
  NamedSessionRow,
} from '@assist/application/ports/assist-session-reader.port';
import { assistSession } from '@assist/infrastructure/persistence/drizzle/schemas/assist-session.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleAssistSessionReader implements AssistSessionReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async sessionsOf(
    ids: readonly string[],
  ): Promise<readonly NamedSessionRow[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.db
      .select({
        id: assistSession.id,
        purpose: assistSession.purpose,
        key: assistSession.key,
        basedOnRun: assistSession.basedOnRunId,
      })
      .from(assistSession)
      .where(inArray(assistSession.id, [...ids]));
  }
}
