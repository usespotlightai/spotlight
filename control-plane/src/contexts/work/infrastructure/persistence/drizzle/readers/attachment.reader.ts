import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  AttachmentReaderPort,
  HeldAttachment,
} from '@work/application/ports/attachment-reader.port';
import { attachmentClaim } from '@work/infrastructure/persistence/drizzle/schemas/attachment.schema';
import { chatAttachment } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { taskAttachment } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleAttachmentReader implements AttachmentReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async find(id: string): Promise<HeldAttachment | null> {
    const [found] = await this.db
      .select({
        workspaceId: attachmentClaim.workspaceId,
        tasked: taskAttachment,
        chatted: chatAttachment,
      })
      .from(attachmentClaim)
      .leftJoin(taskAttachment, eq(taskAttachment.id, attachmentClaim.id))
      .leftJoin(chatAttachment, eq(chatAttachment.id, attachmentClaim.id))
      .where(eq(attachmentClaim.id, id))
      .limit(1);

    const held = found?.tasked ?? found?.chatted;

    return found && held
      ? {
          id: held.id,
          name: held.name,
          contentType: held.contentType,
          size: held.size,
          workspaceId: found.workspaceId,
        }
      : null;
  }
}
