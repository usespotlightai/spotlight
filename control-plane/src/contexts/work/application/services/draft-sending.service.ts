import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LiveTaskDraftsPort } from '@work/application/ports/live-task-drafts.port';
import { TaskDraft } from '@work/domain/aggregates/task-draft.aggregate';
import { TooManyCoAuthorsError } from '@work/domain/exceptions/too-many-co-authors.error';
import { UnknownCoAuthorError } from '@work/domain/exceptions/unknown-co-author.error';
import type { TaskDraftRepository } from '@work/domain/repositories/task-draft.repository';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';

const MAX_CO_AUTHORS = 20;

export class DraftSending {
  constructor(
    private readonly drafts: TaskDraftRepository,
    private readonly access: WorkspaceAccessPort,
    private readonly live: LiveTaskDraftsPort,
    private readonly logger: LoggerPort,
  ) {}

  // Only people who typed in the draft can be co-authors, and only while they can see the workspace.
  async coAuthors(
    taskId: TaskId,
    workspaceId: WorkspaceId,
    ids: readonly string[],
  ): Promise<UserId[]> {
    const named = [...new Set(ids)].map(UserId.of);

    if (named.length > MAX_CO_AUTHORS) {
      throw new TooManyCoAuthorsError(MAX_CO_AUTHORS);
    }

    if (named.length === 0) {
      return [];
    }

    const writers = await this.writersOf(taskId);
    const wrote = named.filter((each) =>
      writers.some((writer) => writer.equals(each)),
    );

    for (const each of wrote) {
      if (!(await this.access.mayView(each, workspaceId))) {
        throw new UnknownCoAuthorError(each.value);
      }
    }

    return wrote;
  }

  async send(
    taskId: TaskId,
    generation: number | null,
  ): Promise<DraftGeneration | null> {
    if (generation === null) {
      return null;
    }

    const draft = (await this.drafts.find(taskId)) ?? TaskDraft.opened(taskId);
    const sent = draft.sent(DraftGeneration.of(generation));
    await this.drafts.save(sent);

    return sent.generation;
  }

  async announce(
    taskId: TaskId,
    next: DraftGeneration | null,
    body: string,
  ): Promise<void> {
    if (!next) {
      return;
    }

    try {
      await this.live.sent(taskId, next, body);
    } catch (error) {
      this.logger.warn(
        { taskId: taskId.value, error },
        'Could not tell the writers of a shared draft that it was sent',
      );
    }
  }

  private async writersOf(taskId: TaskId): Promise<UserId[]> {
    try {
      return await this.live.writers(taskId);
    } catch (error) {
      this.logger.warn(
        { taskId: taskId.value, error },
        'Could not read who wrote a shared draft, so the message names no co-authors',
      );
      return [];
    }
  }
}
