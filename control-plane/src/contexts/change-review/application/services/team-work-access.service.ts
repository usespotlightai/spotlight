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
import type { StackVisibility } from '@change-review/domain/value-objects/stack-visibility.vo';
import { TeamStanding } from '@change-review/domain/value-objects/team-standing.vo';
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

  async seesStack(
    teamId: string,
    visibility: StackVisibility,
    viewerId: string,
  ): Promise<boolean> {
    return visibility.kind === 'task'
      ? (await this.task(teamId, visibility.taskId.value, viewerId)) !== null
      : (await this.run(teamId, visibility.runId.value, viewerId)) !== null;
  }

  async actingOnStack(
    teamId: string,
    visibility: StackVisibility | null,
    viewerId: string,
    unseen: () => Error,
  ): Promise<void> {
    const [seen, standing] = await Promise.all([
      visibility ? this.seesStack(teamId, visibility, viewerId) : false,
      this.standingOn(teamId, viewerId),
    ]);

    standing.actingOn(seen ? visibility : null, unseen);
  }

  async reviewing(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<Reviewing> {
    const access = await this.task(teamId, taskId, viewerId);

    if (!access) {
      throw new UnknownReviewError(`task ${taskId}`);
    }

    return this.authored(access);
  }

  async actingOnTask(
    teamId: string,
    taskId: string,
    viewerId: string,
    unseen: () => Error,
  ): Promise<TaskAccess> {
    const [seen, standing] = await Promise.all([
      this.task(teamId, taskId, viewerId),
      this.standingOn(teamId, viewerId),
    ]);

    return standing.actingOn(seen, unseen);
  }

  async actingOnRun(
    teamId: string,
    runId: string,
    viewerId: string,
    unseen: () => Error,
  ): Promise<RunForReview> {
    const [seen, standing] = await Promise.all([
      this.run(teamId, runId, viewerId),
      this.standingOn(teamId, viewerId),
    ]);

    return standing.actingOn(seen, unseen);
  }

  async actingInReview(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<Reviewing> {
    const [seen, standing] = await Promise.all([
      this.task(teamId, taskId, viewerId),
      this.standingOn(teamId, viewerId),
    ]);

    return this.authored(
      standing.actingOn(seen, () => new UnknownReviewError(`task ${taskId}`)),
    );
  }

  private async authored(access: TaskAccess): Promise<Reviewing> {
    const person = await this.people.find(access.by);

    return {
      ...access,
      author: ReviewAuthor.person(
        access.by,
        AuthorName.of(person?.name ?? null),
      ),
    };
  }

  private async standingOn(
    teamId: string,
    viewerId: string,
  ): Promise<TeamStanding> {
    return TeamStanding.of({
      actsOnTeam: await this.people.actsOnTeam(
        TeamId.of(teamId),
        UserId.of(viewerId),
      ),
    });
  }

  private viewerOf(
    teamId: string,
    viewerId: string,
  ): Promise<TeamViewer | null> {
    return this.people.viewerOf(TeamId.of(teamId), UserId.of(viewerId));
  }
}
