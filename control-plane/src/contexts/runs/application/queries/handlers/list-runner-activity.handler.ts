import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IdleWorkingCopiesPort } from '@runners/application/ports/idle-working-copies.port';
import type {
  LeasedRunDto,
  RunnerActivityDto,
} from '@runs/application/dto/runner-activity.dto';
import type {
  ActivityRunRow,
  RunnerActivityReaderPort,
} from '@runs/application/ports/runner-activity-reader.port';
import type { ListRunnerActivityQuery } from '@runs/application/queries/list-runner-activity.query';
import type { RunTitles } from '@runs/application/services/run-titles.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListRunnerActivityHandler implements QueryHandlerPort<
  ListRunnerActivityQuery,
  RunnerActivityDto | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly activity: RunnerActivityReaderPort,
    private readonly idle: IdleWorkingCopiesPort,
    private readonly titles: RunTitles,
  ) {}

  async execute(
    query: ListRunnerActivityQuery,
  ): Promise<RunnerActivityDto | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const membership = await this.access.inWorkspace(query.slug, viewer);

      if (!membership) {
        return null;
      }

      const [leased, keys] = await Promise.all([
        this.activity.leasedIn(membership.workspaceId),
        this.idle.idleIn(membership.workspaceId),
      ]);
      const lastRuns = await this.activity.lastRunsOf(
        membership.workspaceId,
        keys,
      );
      const titles = await this.titles.of(
        membership.workspaceId,
        [...leased, ...lastRuns],
        viewer,
      );

      const shown = (each: ActivityRunRow): LeasedRunDto => {
        const titled = titles.get(each.runId.value);

        return {
          id: each.runId.value,
          state: each.state,
          kind: each.requester.kind,
          teamId: each.teamId,
          title: titled?.title ?? null,
          hidden: titled?.hidden ?? null,
          opens: titled?.opens ?? null,
        };
      };

      return {
        runners: leased.map((each) => ({
          runnerId: each.runnerId,
          currentRun: shown(each),
        })),
        workingCopies: lastRuns.map((each) => ({
          workingCopyKey: each.workingCopyKey,
          lastRun: shown(each),
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
