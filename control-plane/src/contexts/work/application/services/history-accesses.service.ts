import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TraceScopes } from '@work/application/services/trace-scopes.service';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { HistoryAccess } from '@work/domain/value-objects/history-access.vo';

export interface LeasedHistory {
  readonly team: TeamId;
  readonly access: HistoryAccess;
}

export class HistoryAccesses {
  constructor(
    private readonly leases: RunLeasesPort,
    private readonly dispatches: DispatchRepository,
    private readonly scopes: TraceScopes,
  ) {}

  async leasedBy(
    runId: string,
    runnerId: string,
  ): Promise<LeasedHistory | null> {
    const leased = await this.leases.leasedBy(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );
    const team =
      leased?.team ??
      (leased?.requester.team ? TeamId.of(leased.requester.team) : null);

    if (!leased || !team) {
      return null;
    }

    const subject = (await this.dispatches.find(leased.runId))?.subject;
    const scope = await this.scopes.scopeOf(leased.requester);
    const access = HistoryAccess.for({
      trial: subject?.kind === 'trial' ? { asOf: subject.asOf } : null,
      actsBeyondItself: leased.policy.actsBeyondItself,
      scope: scope && {
        stationId: StationId.of(scope.stationId),
        hiddenTaskIds: scope.hiddenTaskIds.map(TaskId.of),
        shownRunIds: scope.shownRunIds.map(RunId.of),
      },
    });

    return access ? { team, access } : null;
  }
}
