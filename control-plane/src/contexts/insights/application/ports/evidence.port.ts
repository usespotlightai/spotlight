import type {
  JudgedHunk,
  JudgedStep,
} from '@insights/domain/services/judge-evidence';

export const EVIDENCE = Symbol('INSIGHTS_EVIDENCE');

export interface RunEvidence {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly JudgedStep[];
  readonly hunks: readonly JudgedHunk[];
}

export interface StationJudge {
  readonly teamId: string;
  readonly lineId: string;
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly rubricVersion: string;
  readonly sample: number;
  readonly minAgreement: number;
}

export interface EvidencePort {
  hasTask(runId: string): Promise<boolean>;

  of(runId: string): Promise<RunEvidence | null>;

  judgeAt(stationId: string): Promise<StationJudge | null>;

  judgesOnTeam(teamId: string): Promise<ReadonlyMap<string, StationJudge>>;
}
