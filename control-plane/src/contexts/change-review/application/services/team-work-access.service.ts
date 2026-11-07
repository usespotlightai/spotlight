import type {
  PeoplePort,
  TeamViewer,
} from '@change-review/application/ports/people.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { UnknownReviewError } from '@change-review/domain/exceptions/unknown-review.error';
import { TeamAccess } from '@change-review/domain/services/team-access';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface TaskAccess {
  readonly task: ReviewedTask;
  readonly by: UserId;
}

export interface Reviewing extends TaskAccess {
  readonly author: ReviewAuthor;
}

export class TeamWorkAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async task(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<TaskAccess | null> {
    const viewer = await this.viewerOf(teamId, viewerId);
    const task = viewer ? await this.work.task(TaskId.of(taskId)) : null;

    return viewer && task && TeamAccess.of(viewer).allows(task)
      ? { task, by: viewer.by }
      : null;
  }

  async run(
    teamId: string,
    runId: string,
    viewerId: string,
  ): Promise<RunForReview | null> {
    const run = await this.work.run(RunId.of(runId));

    if (!run) {
      return null;
    }

    if (run.taskId) {
      return (await this.task(teamId, run.taskId.value, viewerId)) ? run : null;
    }

    const [viewer, ranFor] = await Promise.all([
      this.viewerOf(teamId, viewerId),
      this.work.teamOfRun(run.id),
    ]);

    return viewer && TeamAccess.of(viewer).allowsTasklessRun(run, ranFor)
      ? run
      : null;
  }

  async reviewing(
    teamId: string,
    runId: string,
    viewerId: string,
  ): Promise<Reviewing> {
    const run = await this.work.run(RunId.of(runId));
    const access = run?.taskId
      ? await this.task(teamId, run.taskId.value, viewerId)
      : null;

    if (!access) {
      throw new UnknownReviewError(`run ${runId}`);
    }

    const person = await this.people.find(access.by);

    return {
      ...access,
      author: ReviewAuthor.person(
        access.by,
        AuthorName.of(person?.name ?? null),
      ),
    };
  }

  private viewerOf(
    teamId: string,
    viewerId: string,
  ): Promise<TeamViewer | null> {
    return this.people.viewerOf(TeamId.of(teamId), UserId.of(viewerId));
  }
}
