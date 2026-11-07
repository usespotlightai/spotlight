import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  ArchiveHolderSource,
  HeldWorkspace,
} from '@runs/application/ports/archive-holders.port';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkArchiveHolders implements ArchiveHolderSource {
  readonly owner = WorkRequesters.owner;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async heldOf(
    names: readonly string[],
  ): Promise<ReadonlyMap<string, HeldWorkspace>> {
    const holders = names.map((name) => ({
      name,
      holder: WorkRequesters.heldBy(name),
    }));
    const taskIds = holders.flatMap(({ holder }) =>
      holder && 'task' in holder ? [holder.task.value] : [],
    );
    const chatIds = holders.flatMap(({ holder }) =>
      holder && 'chat' in holder ? [holder.chat.value] : [],
    );
    const tasks =
      taskIds.length === 0
        ? []
        : await this.db
            .select({
              id: task.id,
              finishedAt: task.finishedAt,
              updatedAt: task.updatedAt,
            })
            .from(task)
            .where(inArray(task.id, taskIds));
    const chats =
      chatIds.length === 0
        ? []
        : await this.db
            .select({
              id: chat.id,
              sessionId: chat.sessionId,
              updatedAt: chat.updatedAt,
            })
            .from(chat)
            .where(inArray(chat.id, chatIds));
    const taskHeld = new Map(
      tasks.map((row): [string, HeldWorkspace] => [
        row.id,
        { released: row.finishedAt !== null, changedAt: row.updatedAt },
      ]),
    );
    const chatHeld = new Map(
      chats.map((row): [string, HeldWorkspace] => [
        row.id,
        { released: row.sessionId === null, changedAt: row.updatedAt },
      ]),
    );

    return new Map(
      holders.flatMap(({ name, holder }): [string, HeldWorkspace][] => {
        const held = !holder
          ? undefined
          : 'task' in holder
            ? taskHeld.get(holder.task.value)
            : chatHeld.get(holder.chat.value);

        return held ? [[name, held]] : [];
      }),
    );
  }
}
