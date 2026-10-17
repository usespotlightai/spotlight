import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunnerActivityDto } from '@work/application/dto/runner-activity.dto';
import type { RunnerActivityReaderPort } from '@work/application/ports/runner-activity-reader.port';
import type { ListRunnerActivityQuery } from '@work/application/queries/list-runner-activity.query';

export class ListRunnerActivityHandler
  implements
    QueryHandlerPort<ListRunnerActivityQuery, RunnerActivityDto[] | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly activity: RunnerActivityReaderPort,
  ) {}

  async execute(
    query: ListRunnerActivityQuery,
  ): Promise<RunnerActivityDto[] | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const membership = await this.access.inWorkspace(query.slug, viewer);

      if (!membership) {
        return null;
      }

      const leased = await this.activity.leasedIn(membership.workspaceId);

      const teams = [
        ...new Set(
          leased.flatMap((each) => (each.teamId ? [each.teamId] : [])),
        ),
      ];
      const reads = new Set(
        (
          await Promise.all(
            teams.map(async (teamId) =>
              (await this.access.permissionsAsTeamReader(
                teamId,
                PersonPrincipal.of(viewer),
              ))
                ? [teamId]
                : [],
            ),
          )
        ).flat(),
      );

      return leased.map((each) => {
        const readable = each.teamId !== null && reads.has(each.teamId);

        return {
          runnerId: each.runnerId,
          currentRun: {
            id: each.runId,
            state: each.state,
            kind: each.kind,
            teamId: each.teamId,
            readable,
            title: readable ? each.title : null,
          },
        };
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
