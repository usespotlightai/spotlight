import type {
  AttachmentReaderPort,
  HeldAttachment,
} from '@application/ports/attachment-reader.port';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
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
    const [found] = await this.db
      .select({
        id: taskAttachment.id,
        name: taskAttachment.name,
        contentType: taskAttachment.contentType,
        size: taskAttachment.size,
        taskId: task.id,
        workspaceId: task.workspaceId,
      })
      .from(taskAttachment)
      .innerJoin(task, eq(task.id, taskAttachment.taskId))
      .where(eq(taskAttachment.id, id))
      .limit(1);

    return found ?? null;
  }
}
