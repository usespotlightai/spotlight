import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { attachmentClaim } from '@work/infrastructure/persistence/drizzle/schemas/attachment.schema';
import { sql } from 'drizzle-orm';

type Holder = { readonly taskId: string } | { readonly chatId: string };

export const claimAttachments = async (
  db: DrizzleDatabase,
  workspaceId: WorkspaceId,
  holder: Holder,
  attachments: readonly Attachment[],
): Promise<void> => {
  const ids = [...new Set(attachments.map((each) => each.id.value))];

  if (ids.length === 0) {
    return;
  }

  const taskId = 'taskId' in holder ? holder.taskId : null;
  const chatId = 'chatId' in holder ? holder.chatId : null;

  const claimed = await db
    .insert(attachmentClaim)
    .values(
      ids.map((id) => ({
        id,
        workspaceId: workspaceId.value,
        taskId,
        chatId,
      })),
    )
    .onConflictDoUpdate({
      target: attachmentClaim.id,
      set: { id: sql`excluded.id` },
      setWhere: sql`${attachmentClaim.taskId} is not distinct from excluded.task_id and ${attachmentClaim.chatId} is not distinct from excluded.chat_id`,
    })
    .returning({ id: attachmentClaim.id });

  if (claimed.length < ids.length) {
    throw new InvalidAttachmentError('was given to something else already');
  }
};
