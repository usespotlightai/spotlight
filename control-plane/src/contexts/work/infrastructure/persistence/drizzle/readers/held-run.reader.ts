import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  HeldAttachment,
  HeldContinuity,
  HeldRunReaderPort,
  PendingSaying,
} from '@work/application/ports/held-run-reader.port';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
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
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';

interface AttachedRow {
  readonly at: number | null;
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

const holderOf = (held: {
  taskId: string | null;
  stationId: string | null;
  chatId: string | null;
}): ArchiveHolder | null => {
  if (held.taskId && held.stationId) {
    return {
      kind: 'task',
      taskId: TaskId.of(held.taskId),
      stationId: StationId.of(held.stationId),
    };
  }

  return held.chatId ? { kind: 'chat', chatId: ChatId.of(held.chatId) } : null;
};

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
export class DrizzleHeldRunReader implements HeldRunReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async pendingFor(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<readonly PendingSaying[] | null> {
    const held = await this.held(runId, runnerId);

    if (!held) {
      return null;
    }

    if (held.taskId) {
      return this.pendingOnTask(held.taskId, runId);
    }

    return held.chatId ? this.pendingInChat(held.chatId) : [];
  }

  async stopRequestedFor(runId: RunId, runnerId: RunnerId): Promise<boolean> {
    const held = await this.held(runId, runnerId);

    return held?.stopRequestedAt != null;
  }

  async attachmentFor(
    runId: RunId,
    runnerId: RunnerId,
    attachmentId: string,
  ): Promise<HeldAttachment | null> {
    const held = await this.held(runId, runnerId);

    if (!held) {
      return null;
    }

    const found = held.taskId
      ? await this.attachedToTask(held.taskId, attachmentId)
      : held.chatId
        ? await this.attachedInChat(held.chatId, attachmentId)
        : null;

    return found
      ? {
          workspaceId: WorkspaceId.of(held.workspaceId),
          attachment: Attachment.rehydrate(found),
        }
      : null;
  }

  async continuityOf(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<HeldContinuity | null> {
    const [row] = await this.db
      .select({
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        stationId: run.stationId,
        chatId: run.chatId,
        key: sql<string | null>`${run.spec}->'continuity'->>'key'`,
        sessionId: sql<string | null>`${run.spec}->'continuity'->>'sessionId'`,
      })
      .from(run)
      .where(
        and(
          eq(run.id, runId.value),
          eq(run.claimedBy, runnerId.value),
          eq(run.state, 'claimed'),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      workspaceId: WorkspaceId.of(row.workspaceId),
      continuity: row.key ? ContinuityKey.of(row.key) : null,
      holder: holderOf(row),
      continuing: Boolean(row.sessionId),
    };
  }

  private async held(runId: RunId, runnerId: RunnerId) {
    const [row] = await this.db
      .select({
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        chatId: run.chatId,
        stopRequestedAt: run.stopRequestedAt,
      })
      .from(run)
      .where(
        and(
          eq(run.id, runId.value),
          eq(run.claimedBy, runnerId.value),
          eq(run.state, 'claimed'),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  private async attachedToTask(taskId: string, attachmentId: string) {
    const [row] = await this.db
      .select({
        id: taskAttachment.id,
        name: taskAttachment.name,
        contentType: taskAttachment.contentType,
        size: taskAttachment.size,
      })
      .from(taskAttachment)
      .where(
        and(
          eq(taskAttachment.taskId, taskId),
          eq(taskAttachment.id, attachmentId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  private async attachedInChat(chatId: string, attachmentId: string) {
    const [row] = await this.db
      .select({
        id: chatAttachment.id,
        name: chatAttachment.name,
        contentType: chatAttachment.contentType,
        size: chatAttachment.size,
      })
      .from(chatAttachment)
      .where(
        and(
          eq(chatAttachment.chatId, chatId),
          eq(chatAttachment.id, attachmentId),
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
            eq(taskNote.kind, 'said'),
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
