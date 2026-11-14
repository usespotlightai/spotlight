import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IdleWorkingCopiesPort } from '@runners/application/ports/idle-working-copies.port';
import type {
  LeasedRunDto,
  RunnerActivityDto,
} from '@runs/application/dto/runner-activity.dto';
import { requesterRefOf } from '@runs/application/ports/run-requester-labels.port';
import type {
  ActivityRunRow,
  RunnerActivityReaderPort,
} from '@runs/application/ports/runner-activity-reader.port';
import type { ListRunnerActivityQuery } from '@runs/application/queries/list-runner-activity.query';
import type { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import type { RunViewing } from '@runs/application/services/run-viewing.service';
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
    private readonly labels: RunRequesterLabels,
    private readonly viewers: RunViewing,
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
      const runs = [...leased, ...lastRuns];
      const [labels, readable] = await Promise.all([
        this.labels.labelsOf(runs.map((each) => each.requester)),
        this.viewers.readableAmong(runs, viewer),
      ]);

      const shown = (each: ActivityRunRow): LeasedRunDto => {
        const reads = readable.has(each.runId.value);

        return {
          id: each.runId.value,
          state: each.state,
          kind: each.requester.kind,
          teamId: each.teamId,
          readable: reads,
          title: reads
            ? (labels.get(requesterRefOf(each.requester))?.title ?? null)
            : null,
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
