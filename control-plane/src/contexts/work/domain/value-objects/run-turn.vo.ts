import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { HandoverReport } from '@work/domain/value-objects/handover-report.vo';

export const RUN_TURN_STATES = ['pending', 'kept'] as const;

export type RunTurnState = (typeof RUN_TURN_STATES)[number];

export class RunTurn {
  private constructor(
    readonly state: RunTurnState,
    readonly report: HandoverReport,
    readonly reportedBy: RunnerId,
    readonly suspendedAt: Date,
  ) {}

  static pending(
    report: HandoverReport,
    reportedBy: RunnerId,
    suspendedAt: Date,
  ): RunTurn {
    return new RunTurn('pending', report, reportedBy, suspendedAt);
  }

  static rehydrate(input: {
    state: RunTurnState;
    report: HandoverReport;
    reportedBy: RunnerId;
    suspendedAt: Date;
  }): RunTurn {
    return new RunTurn(
      input.state,
      input.report,
      input.reportedBy,
      input.suspendedAt,
    );
  }

  get pending(): boolean {
    return this.state === 'pending';
  }

  kept(): RunTurn {
    return this.pending
      ? new RunTurn('kept', this.report, this.reportedBy, this.suspendedAt)
      : this;
  }
}
