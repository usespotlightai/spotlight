import { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import type { ChangeJudgingRepository } from '@replays/domain/repositories/change-judging.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeJudgingRequest {
  readonly run: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId | null;
}

export type ChangeJudgingAnswer = 'requested';

export type ChangeJudgingAgainAnswer = 'requested' | 'unjudged';

export class RequestChangeJudging {
  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async request(request: ChangeJudgingRequest): Promise<ChangeJudgingAnswer> {
    const judging = ChangeJudging.requested({
      runId: request.run,
      workspaceId: request.workspaceId,
      teamId: request.teamId,
      criteria: request.criteria,
      reference: request.reference,
      now: this.clock.now(),
    });

    await this.transaction.inTransaction(async () => {
      if (!(await this.judgings.of(judging.runId, judging.attempt))) {
        await this.judgings.add(judging);
      }
    });

    return 'requested';
  }

  requeue(run: RunId): Promise<ChangeJudgingAgainAnswer> {
    return this.transaction.inTransaction(async () => {
      const first = await this.judgings.of(run, 1);

      if (!first?.judgedAt) {
        return 'unjudged';
      }
      if (!(await this.judgings.of(run, 2))) {
        await this.judgings.add(first.requeued(this.clock.now()));
      }

      return 'requested';
    });
  }
}
