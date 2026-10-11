import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { SetupConnectionDto } from '@work/application/dto/onboarding.dto';
import type {
  LineReaderPort,
  ReviewInvitation,
} from '@work/application/ports/line-reader.port';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import type {
  OpeningSource,
  TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';

const GITHUB = 'github';

const HEARD = 'Task opened';

const githubFrom = (review: ReviewInvitation | null): OpeningSource => ({
  source: GITHUB,
  name: 'GitHub',
  tryIt: review
    ? `Add the ${review.label} label to a pull request, or mention ${review.mention} on one.`
    : null,
  heard: 'Review asked for',
  link: review?.repository
    ? {
        label: 'Open pull requests',
        url: `https://github.com/${review.repository}/pulls`,
      }
    : null,
});

export class SetupConnections {
  constructor(
    private readonly lines: LineReaderPort,
    private readonly integrations: TeamIntegrationsPort,
    private readonly tasks: TaskReaderPort,
  ) {}

  async of(teamId: TeamId): Promise<readonly SetupConnectionDto[]> {
    const [review, opening, firstOpened] = await Promise.all([
      this.lines.reviewInvitationOf(teamId),
      this.integrations.opening(teamId),
      this.tasks.firstOpenedFrom(teamId),
    ]);
    const sources = [
      githubFrom(review),
      ...opening.filter((each) => each.source !== GITHUB),
    ];

    return sources.map((each) => ({
      source: each.source,
      name: each.name,
      tryIt: each.tryIt ?? `Send anything from ${each.name} that opens a task.`,
      heard: each.heard ?? HEARD,
      link: each.link,
      firstOpenedAt: firstOpened.get(each.source) ?? null,
    }));
  }
}
