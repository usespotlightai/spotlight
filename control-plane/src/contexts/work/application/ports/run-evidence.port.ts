export const RUN_EVIDENCE = Symbol('RUN_EVIDENCE');

export interface EvidencedStep {
  readonly index: number;
  readonly kind: string;
  readonly tool: string | null;
  readonly text: string;
  readonly given: string | null;
  readonly returned: string | null;
}

export interface EvidencedHunk {
  readonly id: string;
  readonly path: string;
  readonly index: number;
  readonly header: string;
  readonly lines: readonly string[];
}

export interface StationJudgeSettings {
  readonly teamId: string;
  readonly lineId: string;
  readonly rubric: string;
  readonly rubricVersion: string;
  readonly sample: number;
  readonly trust: number;
}

export interface EvidencedRun {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly EvidencedStep[];
  readonly hunks: readonly EvidencedHunk[];
}

export interface RunEvidencePort {
  holds(runId: string): Promise<boolean>;

  of(runId: string): Promise<EvidencedRun | null>;

  judgeAt(stationId: string): Promise<StationJudgeSettings | null>;
}
