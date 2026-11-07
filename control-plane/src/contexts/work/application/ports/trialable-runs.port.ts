import type { UntrialableReasonCode } from '@work/application/contracts/untrialable-reason.contract';

export const TRIALABLE_RUNS = Symbol('TRIALABLE_RUNS');

export interface Trialability {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly untrialableReason: UntrialableReasonCode | null;
  readonly description: string | null;
}

export interface TrialableRunSummary extends Trialability {
  readonly title: string | null;
  readonly state: string | null;
  readonly endedAt: Date | null;
}

export interface RecentTrialableRun extends Trialability {
  readonly title: string;
  readonly state: string;
  readonly endedAt: Date;
}

export interface TrialableRunsPort {
  summaries(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly TrialableRunSummary[]>;

  recentAt(
    workspaceId: string,
    stationId: string,
    max: number,
  ): Promise<readonly RecentTrialableRun[]>;
}
