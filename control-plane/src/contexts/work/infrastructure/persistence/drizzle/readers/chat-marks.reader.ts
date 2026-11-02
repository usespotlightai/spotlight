import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { ChatMarksPort } from '@work/application/ports/chat-marks.port';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { chatMark } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleChatMarks implements ChatMarksPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async ambientOf(chatId: ChatId): Promise<readonly Mark[]> {
    const rows = await this.db
      .select({ kind: chatMark.kind, value: chatMark.value })
      .from(chatMark)
      .where(and(eq(chatMark.chatId, chatId.value), eq(chatMark.finds, false)));

    return rows.map((row) => Mark.of(row.kind, row.value));
  }
}
