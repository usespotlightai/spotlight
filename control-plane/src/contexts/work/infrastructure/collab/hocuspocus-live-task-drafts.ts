import { Injectable } from '@nestjs/common';
import { documentName } from '@platform/collab/collab-documents';
import { CollabServer } from '@platform/collab/collab-server';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import {
  TASK_DRAFT_DOCUMENT,
  TASK_DRAFT_META,
  TASK_DRAFT_PARTS,
} from '@work/application/contracts/task-draft-document.contract';
import type { LiveTaskDraftsPort } from '@work/application/ports/live-task-drafts.port';
import type { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import type { Doc } from 'yjs';

const draftParts = (doc: Doc) => ({
  meta: doc.getMap<number | string>(TASK_DRAFT_PARTS.meta),
  writers: doc.getMap<boolean>(TASK_DRAFT_PARTS.writers),
  attachments: doc.getArray<unknown>(TASK_DRAFT_PARTS.attachments),
});

@Injectable()
export class HocuspocusLiveTaskDrafts implements LiveTaskDraftsPort {
  constructor(private readonly collab: CollabServer) {}

  writers(taskId: TaskId): Promise<UserId[]> {
    return this.collab.read(
      documentName(TASK_DRAFT_DOCUMENT, taskId.value),
      (doc) => [...draftParts(doc).writers.keys()].map(UserId.of),
    );
  }

  async sent(
    taskId: TaskId,
    next: DraftGeneration,
    body: string,
  ): Promise<void> {
    await this.collab.change(
      documentName(TASK_DRAFT_DOCUMENT, taskId.value),
      (doc) => {
        const { meta, writers, attachments } = draftParts(doc);

        meta.set(TASK_DRAFT_META.generation, next.value);
        meta.set(TASK_DRAFT_META.sent, body.trim());
        writers.clear();
        attachments.delete(0, attachments.length);
      },
    );
  }
}
