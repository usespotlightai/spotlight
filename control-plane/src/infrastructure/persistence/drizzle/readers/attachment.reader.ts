import type {
  AttachmentReaderPort,
  HeldAttachment,
} from '@application/ports/attachment-reader.port';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  chat,
  chatAttachment,
} from '@infrastructure/persistence/drizzle/schemas/chat.schema';
import {
  task,
  taskAttachment,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleAttachmentReader implements AttachmentReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async find(id: string): Promise<HeldAttachment | null> {
    const [tasked] = await this.db
      .select({
        id: taskAttachment.id,
        name: taskAttachment.name,
        contentType: taskAttachment.contentType,
        size: taskAttachment.size,
        workspaceId: task.workspaceId,
      })
      .from(taskAttachment)
      .innerJoin(task, eq(task.id, taskAttachment.taskId))
      .where(eq(taskAttachment.id, id))
      .limit(1);

    if (tasked) {
      return tasked;
    }

    const [chatted] = await this.db
      .select({
        id: chatAttachment.id,
        name: chatAttachment.name,
        contentType: chatAttachment.contentType,
        size: chatAttachment.size,
        workspaceId: chat.workspaceId,
      })
      .from(chatAttachment)
      .innerJoin(chat, eq(chat.id, chatAttachment.chatId))
      .where(eq(chatAttachment.id, id))
      .limit(1);

    return chatted ?? null;
  }
}
