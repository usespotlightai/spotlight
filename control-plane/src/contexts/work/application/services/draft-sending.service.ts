import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LiveTaskDraftsPort } from '@work/application/ports/live-task-drafts.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownCoAuthorError } from '@work/domain/exceptions/unknown-co-author.error';
import { CoAuthors } from '@work/domain/value-objects/co-authors.vo';
import type { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';

export class DraftSending {
  constructor(
    private readonly access: WorkAccess,
    private readonly live: LiveTaskDraftsPort,
    private readonly logger: LoggerPort,
  ) {}

  async coAuthors(
    taskId: TaskId,
    teamId: TeamId,
    ids: readonly string[],
  ): Promise<UserId[]> {
    const named = CoAuthors.named(ids.map(UserId.of));

    if (named.named.length === 0) {
      return [];
    }

    const wrote = named.whoWrote(await this.writersOf(taskId));

    for (const each of wrote) {
      if (!(await this.access.standingOn(teamId, each)).actsOnTasks) {
        throw new UnknownCoAuthorError(each.value);
      }
    }

    return wrote;
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
