import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunnerActivityDto } from '@work/application/dto/runner-activity.dto';
import { requesterRefOf } from '@work/application/ports/run-requester-labels.port';
import type { RunViewersPort } from '@work/application/ports/run-viewers.port';
import {
  LEASED_RUN_KINDS,
  type LeasedRunKind,
  type RunnerActivityReaderPort,
} from '@work/application/ports/runner-activity-reader.port';
import type { ListRunnerActivityQuery } from '@work/application/queries/list-runner-activity.query';
import type { RunRequesterLabels } from '@work/application/services/run-requester-labels.service';

const kindOf = (kind: string): LeasedRunKind =>
  LEASED_RUN_KINDS.find((each) => each === kind) ?? 'spec';

export class ListRunnerActivityHandler
  implements
    QueryHandlerPort<ListRunnerActivityQuery, RunnerActivityDto[] | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly activity: RunnerActivityReaderPort,
    private readonly labels: RunRequesterLabels,
    private readonly viewers: RunViewersPort,
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
      const [labels, readable] = await Promise.all([
        this.labels.labelsOf(leased.map((each) => each.requester)),
        this.viewers.readableAmong(leased, viewer),
      ]);

      return leased.map((each) => {
        const reads = readable.has(each.runId.value);

        return {
          runnerId: each.runnerId,
          currentRun: {
            id: each.runId.value,
            state: each.state,
            kind: kindOf(each.requester.kind),
            teamId: each.teamId,
            readable: reads,
            title: reads
              ? (labels.get(requesterRefOf(each.requester))?.title ?? null)
              : null,
          },
        };
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
