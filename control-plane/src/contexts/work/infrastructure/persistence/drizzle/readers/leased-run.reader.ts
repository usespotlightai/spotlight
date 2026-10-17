import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  LeasedRunReaderPort,
  PendingSaying,
} from '@work/application/ports/leased-run-reader.port';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { LEASED_RUN_STATES } from '@work/domain/value-objects/run-state';
import {
  chatAttachment,
  chatMessage,
} from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  task,
  taskAttachment,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';

interface AttachedRow {
  readonly at: number | null;
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

const sayings = (
  said: readonly { position: number; body: string }[],
  attached: readonly AttachedRow[],
): PendingSaying[] =>
  said.map((each) => ({
    position: each.position,
    body: each.body,
    attachments: attached
      .filter((row) => row.at === each.position)
      .map((row) => Attachment.rehydrate(row)),
  }));

@Injectable()
export class DrizzleLeasedRunReader implements LeasedRunReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async pendingFor(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<readonly PendingSaying[] | null> {
    const leased = await this.leased(runId, runnerId);

    if (!leased) {
      return null;
    }

    if (leased.taskId) {
      return this.pendingOnTask(leased.taskId, runId);
    }

    return leased.chatId ? this.pendingInChat(leased.chatId) : [];
  }

  async stopRequestedFor(runId: RunId, runnerId: RunnerId): Promise<boolean> {
    const leased = await this.leased(runId, runnerId);

    return leased?.stopRequestedAt != null;
  }

  private async leased(runId: RunId, runnerId: RunnerId) {
    const [row] = await this.db
      .select({
        taskId: run.taskId,
        chatId: run.chatId,
        stopRequestedAt: run.stopRequestedAt,
      })
      .from(run)
      .where(
        and(
          eq(run.id, runId.value),
          eq(run.claimedBy, runnerId.value),
          inArray(run.state, [...LEASED_RUN_STATES]),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  private async pendingOnTask(
    taskId: string,
    runId: RunId,
  ): Promise<PendingSaying[]> {
    const [said, attached] = await Promise.all([
      this.db
        .select({ position: taskNote.position, body: taskNote.body })
        .from(taskNote)
        .innerJoin(
          task,
          and(eq(task.id, taskNote.taskId), eq(task.currentRunId, runId.value)),
        )
        .where(
          and(
            eq(taskNote.taskId, taskId),
            inArray(taskNote.kind, ['said', 'answered']),
            ne(taskNote.voice, 'station'),
            isNull(taskNote.deliveredAt),
          ),
        )
        .orderBy(asc(taskNote.position)),
      this.db
        .select({
          at: taskAttachment.notePosition,
          id: taskAttachment.id,
          name: taskAttachment.name,
          contentType: taskAttachment.contentType,
          size: taskAttachment.size,
        })
        .from(taskAttachment)
        .where(eq(taskAttachment.taskId, taskId))
        .orderBy(asc(taskAttachment.place)),
    ]);

    return sayings(said, attached);
  }

  private async pendingInChat(chatId: string): Promise<PendingSaying[]> {
    const [said, attached] = await Promise.all([
      this.db
        .select({ position: chatMessage.position, body: chatMessage.body })
        .from(chatMessage)
        .where(
          and(
            eq(chatMessage.chatId, chatId),
            eq(chatMessage.kind, 'said'),
            isNull(chatMessage.deliveredAt),
          ),
        )
        .orderBy(asc(chatMessage.position)),
      this.db
        .select({
          at: chatAttachment.messagePosition,
          id: chatAttachment.id,
          name: chatAttachment.name,
          contentType: chatAttachment.contentType,
          size: chatAttachment.size,
        })
        .from(chatAttachment)
        .where(eq(chatAttachment.chatId, chatId))
        .orderBy(asc(chatAttachment.place)),
    ]);

    return sayings(said, attached);
  }
}
