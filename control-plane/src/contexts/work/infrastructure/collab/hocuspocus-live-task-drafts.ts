import { Injectable } from '@nestjs/common';
import { documentName } from '@platform/collab/collab-documents';
import { CollabServer } from '@platform/collab/collab-server';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LiveTaskDraftsPort } from '@work/application/ports/live-task-drafts.port';
import type { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import {
  draftParts,
  TASK_DRAFT,
} from '@work/infrastructure/collab/task-draft.document';

@Injectable()
export class HocuspocusLiveTaskDrafts implements LiveTaskDraftsPort {
  constructor(private readonly collab: CollabServer) {}

  writers(taskId: TaskId): Promise<UserId[]> {
    return this.collab.read(documentName(TASK_DRAFT, taskId.value), (doc) =>
      [...draftParts(doc).writers.keys()].map(UserId.of),
    );
  }

  async sent(
    taskId: TaskId,
    next: DraftGeneration,
    body: string,
  ): Promise<void> {
    await this.collab.change(documentName(TASK_DRAFT, taskId.value), (doc) => {
      const { meta, writers, attachments } = draftParts(doc);

      meta.set('generation', next.value);
      meta.set('sent', body.trim());
      writers.clear();
      attachments.delete(0, attachments.length);
    });
  }
}
