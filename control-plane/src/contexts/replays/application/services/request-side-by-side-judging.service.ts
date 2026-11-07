import type { PairJudgePort } from '@replays/application/ports/pair-judge.port';
import { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import { SideBySideJudgingVersionConflictError } from '@replays/domain/exceptions/side-by-side-judging-version-conflict.error';
import type { SideBySideJudgingRepository } from '@replays/domain/repositories/side-by-side-judging.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SideBySideJudgingRequest {
  readonly run: RunId;
  readonly other: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId;
  readonly maxAttempts: number;
}

export type SideBySideJudgingAnswer = 'requested' | 'unavailable';

export class RequestSideBySideJudging {
  constructor(
    private readonly judgings: SideBySideJudgingRepository,
    private readonly judge: PairJudgePort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async request(
    request: SideBySideJudgingRequest,
  ): Promise<SideBySideJudgingAnswer> {
    if (!this.judge.available) {
      return 'unavailable';
    }

    const judging = SideBySideJudging.requested({
      runId: request.run,
      otherRunId: request.other,
      workspaceId: request.workspaceId,
      teamId: request.teamId,
      criteria: request.criteria,
      reference: request.reference,
      maxAttempts: request.maxAttempts,
      now: this.clock.now(),
    });

    try {
      await this.transaction.inTransaction(() => this.judgings.add(judging));
    } catch (error) {
      if (!(error instanceof SideBySideJudgingVersionConflictError)) {
        throw error;
      }
    }

    return 'requested';
  }
}
