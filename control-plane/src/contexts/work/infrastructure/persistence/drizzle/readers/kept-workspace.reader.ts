import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  KeptWorkspace,
  KeptWorkspaceReaderPort,
} from '@work/application/ports/kept-workspace-reader.port';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, eq, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleKeptWorkspaceReader implements KeptWorkspaceReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listFor(runnerId: RunnerId): Promise<KeptWorkspace[]> {
    const [tasks, chats] = await Promise.all([
      this.db
        .select({ taskId: task.id, stationId: task.stationId })
        .from(task)
        .where(
          and(eq(task.runnerId, runnerId.value), isNotNull(task.sessionId)),
        ),
      this.db
        .select({ chatId: chat.id })
        .from(chat)
        .where(
          and(eq(chat.runnerId, runnerId.value), isNotNull(chat.sessionId)),
        ),
    ]);

    return [...tasks, ...chats];
  }
}
