import type {
  KeptWorkspace,
  KeptWorkspaceReaderPort,
} from '@application/ports/kept-workspace-reader.port';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { chat } from '@infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { Inject, Injectable } from '@nestjs/common';
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
