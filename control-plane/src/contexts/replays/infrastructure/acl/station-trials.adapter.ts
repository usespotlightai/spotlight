import type {
  StationTrialsPort,
  TrialOrdering,
  TrialRequest,
} from '@replays/application/ports/station-trials.port';
import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { UNTRIALABLE } from '@replays/infrastructure/acl/work.adapter';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  TrialFollowUp,
  StationTrialsPort as WorkStationTrialsPort,
} from '@work/application/ports/station-trials.port';

const FOLLOW_UP: Readonly<Record<OracleAnswer, TrialFollowUp>> = {
  accepted: 'accepted',
  'sent-back': 'sent-back',
};

export class StationTrials implements StationTrialsPort {
  constructor(private readonly trials: WorkStationTrialsPort) {}

  async answers(original: RunId): Promise<readonly OracleAnswer[]> {
    const followUps = await this.trials.followUpsOf(original.value);

    return [
      ...(followUps?.accepted ? (['accepted'] as const) : []),
      ...(followUps?.sentBack ? (['sent-back'] as const) : []),
    ];
  }

  async order(request: TrialRequest): Promise<TrialOrdering> {
    const ordering = await this.trials.order({
      runId: request.run.value,
      basedOn: request.original.value,
      workspaceId: request.workspaceId.value,
      lineId: request.lineId.value,
      stationId: request.stationId.value,
      config: request.block,
      ...(request.repositories === undefined
        ? {}
        : { repositories: request.repositories }),
      followUp: request.answer && FOLLOW_UP[request.answer],
    });

    if (ordering.outcome === 'untrialable') {
      return {
        ordered: false,
        unreplayableReason: UNTRIALABLE[ordering.reason],
        reason: ordering.description,
      };
    }

    const { team, ...order } = ordering.order;

    return {
      ordered: true,
      order,
      team,
      fingerprint: ordering.fingerprint
        ? StationFingerprint.of(ordering.fingerprint)
        : null,
      checkouts: ordering.checkouts,
      movesOnAfter: ordering.movesOnAfter,
    };
  }

  withdraw(run: RunId): Promise<void> {
    return this.trials.withdraw(run.value);
  }
}
