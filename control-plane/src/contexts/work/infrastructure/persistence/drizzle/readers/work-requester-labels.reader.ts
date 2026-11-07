import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  type LabelledRequester,
  type RequesterLabel,
  type RunRequesterLabelSource,
  requesterRefOf,
} from '@runs/application/ports/run-requester-labels.port';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkRequesterLabels implements RunRequesterLabelSource {
  readonly owner = WorkRequesters.owner;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async labelsOf(
    requesters: readonly LabelledRequester[],
  ): Promise<ReadonlyMap<string, RequesterLabel>> {
    const taskIds = requesters.flatMap((each) => {
      const taskId = WorkRequesters.taskOf(each);
      return taskId ? [taskId.value] : [];
    });
    const chatIds = requesters.flatMap((each) => {
      const chatId = WorkRequesters.chatOf(each);
      return chatId ? [chatId.value] : [];
    });
    const [tasks, chats] = await Promise.all([
      taskIds.length === 0
        ? []
        : this.db
            .select({ id: task.id, title: task.title })
            .from(task)
            .where(inArray(task.id, taskIds)),
      chatIds.length === 0
        ? []
        : this.db
            .select({ id: chat.id, title: chat.title })
            .from(chat)
            .where(inArray(chat.id, chatIds)),
    ]);

    return new Map([
      ...tasks.map(
        (row) =>
          [
            requesterRefOf({ owner: this.owner, kind: 'task', id: row.id }),
            { title: row.title },
          ] as const,
      ),
      ...chats.map(
        (row) =>
          [
            requesterRefOf({ owner: this.owner, kind: 'chat', id: row.id }),
            { title: row.title },
          ] as const,
      ),
    ]);
  }
}
