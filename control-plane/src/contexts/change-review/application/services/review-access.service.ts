import type { PeoplePort } from '@change-review/application/ports/people.port';
import type { ReviewCommentAuthor } from '@change-review/domain/aggregates/review-comment.aggregate';
import { UnknownReviewError } from '@change-review/domain/exceptions/unknown-review.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  TaskLookup,
  WorkLookupPort,
} from '@work/application/ports/work-lookup.port';

export interface Reviewing {
  readonly task: TaskLookup;
  readonly by: UserId;
  readonly author: ReviewCommentAuthor;
}

export class ReviewAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkLookupPort,
  ) {}

  async ofRun(
    teamId: string,
    runId: string,
    viewerId: string,
  ): Promise<Reviewing> {
    const member = await this.people.memberOf(teamId, viewerId);
    const run = member ? await this.work.run(RunId.of(runId)) : null;

    if (!member || !run?.workspaceId.equals(member.workspaceId)) {
      throw new UnknownReviewError('run');
    }

    const task = run.taskId ? await this.work.task(run.taskId) : null;

    if (!task) {
      throw new UnknownReviewError('task');
    }

    const person = await this.people.find(member.by);

    return {
      task,
      by: member.by,
      author: {
        userId: member.by,
        login: null,
        name: person?.name ?? 'Someone',
      },
    };
  }
}
