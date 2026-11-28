import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkTitlesReaderPort } from '@work/application/ports/work-titles-reader.port';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkTitlesReader implements WorkTitlesReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async taskTitles(
    taskIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const rows =
      taskIds.length === 0
        ? []
        : await this.db
            .select({ id: task.id, title: task.title })
            .from(task)
            .where(inArray(task.id, [...taskIds]));

    return new Map(rows.map((row) => [row.id, row.title]));
  }

  async chatTitles(
    chatIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const rows =
      chatIds.length === 0
        ? []
        : await this.db
            .select({ id: chat.id, title: chat.title })
            .from(chat)
            .where(inArray(chat.id, [...chatIds]));

    return new Map(rows.map((row) => [row.id, row.title]));
  }
}
