import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { UnknownReviewError } from '@change-review/domain/exceptions/unknown-review.error';
import { TeamAccess } from '@change-review/domain/services/team-access';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface Reviewing {
  readonly task: ReviewedTask;
  readonly by: UserId;
  readonly author: ReviewAuthor;
}

export class ReviewAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async ofRun(
    teamId: string,
    runId: string,
    viewerId: string,
  ): Promise<Reviewing> {
    const member = await this.people.memberOf(teamId, viewerId);
    const run = member ? await this.work.run(RunId.of(runId)) : null;
    const task = run?.taskId ? await this.work.task(run.taskId) : null;

    if (!member || !task || !TeamAccess.of(member).allows(task)) {
      throw new UnknownReviewError(`run ${runId}`);
    }

    const person = await this.people.find(member.by);

    return {
      task,
      by: member.by,
      author: ReviewAuthor.person(
        member.by,
        AuthorName.of(person?.name ?? null),
      ),
    };
  }
}
