import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TraceScopes } from '@work/application/services/trace-scopes.service';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { HistoryAccess } from '@work/domain/services/history-access';

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

    if (subject?.kind === 'trial') {
      return { team, access: HistoryAccess.ofTrial(subject.asOf) };
    }

    if (leased.policy.actsBeyondItself) {
      return { team, access: HistoryAccess.unrestricted() };
    }

    const scope = await this.scopes.scopeOf(leased.requester);

    return scope ? { team, access: HistoryAccess.scopedTo(scope) } : null;
  }
}
