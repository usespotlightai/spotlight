import type { WorkPort } from '@outcomes/application/ports/work.port';
import type {
  TeamHistories,
  TeamScope,
} from '@outcomes/application/services/team-histories.service';
import type { PullRequestRecordRepository } from '@outcomes/domain/repositories/pull-request-record.repository';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskChangeShapeRepository } from '@outcomes/domain/repositories/task-change-shape.repository';
import {
  type TeamPullRequest,
  teamPullRequestOf,
} from '@outcomes/domain/services/team-pull-requests';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const MOST_PULL_REQUESTS = 20_000;

export interface TeamPullRequestsHeld {
  readonly records: PullRequestRecordRepository;
  readonly runs: RunRecordRepository;
  readonly shapes: TaskChangeShapeRepository;
}

export interface TeamPullRequestsInPeriod extends TeamScope {
  readonly repositories: readonly string[];
  readonly pullRequests: readonly TeamPullRequest[];
  readonly truncated: boolean;
}

export class TeamPullRequests {
  constructor(
    private readonly histories: TeamHistories,
    private readonly work: WorkPort,
    private readonly held: TeamPullRequestsHeld,
  ) {}

  async of(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamPullRequestsInPeriod> {
    const scope = await this.histories.scope(teamId, principal, period);
    const repositories = await this.work.teamRepositories(
      scope.clearance.teamId.value,
    );
    const found = await this.held.records.seenForTeamBetween(
      {
        workspaceId: scope.clearance.workspaceId,
        teamId: scope.clearance.teamId,
        repositories,
        from: scope.period.current.from,
        to: scope.period.current.to,
      },
      MOST_PULL_REQUESTS + 1,
    );
    const truncated = found.length > MOST_PULL_REQUESTS;
    const records = truncated ? found.slice(0, MOST_PULL_REQUESTS) : found;
    const owners = [
      ...new Map(
        records.flatMap((each) =>
          each.owner
            ? [[each.owner.taskId.value, each.owner.taskId] as const]
            : [],
        ),
      ).values(),
    ];
    const spends = new Map<string, (Spend | null)[]>();

    for (const run of await this.held.runs.ofTasks(owners)) {
      if (run.taskId) {
        spends.set(run.taskId.value, [
          ...(spends.get(run.taskId.value) ?? []),
          run.cost?.spend ?? null,
        ]);
      }
    }

    const shapes = new Map(
      (await this.held.shapes.forTasks(owners)).map((each) => [
        each.taskId.value,
        each,
      ]),
    );

    return {
      ...scope,
      repositories,
      truncated,
      pullRequests: records.flatMap((record) => {
        const owner = record.owner?.taskId.value;
        const view = teamPullRequestOf(
          record,
          (owner && shapes.get(owner)) || null,
          (owner && spends.get(owner)) || [],
        );
        return view ? [view] : [];
      }),
    };
  }
}
