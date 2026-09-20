interface ChangeStackCheckStepDto {
  readonly id: string;
  readonly patch: string;
}

interface ChangeStackCheckDto {
  readonly stackId: string;
  readonly repository: string | null;
  readonly command: string;
  readonly steps: readonly ChangeStackCheckStepDto[];
}

export interface ChangeStackChecksDto {
  readonly waiting: boolean;
  readonly checks: readonly ChangeStackCheckDto[];
}

export interface CheckedStepDto {
  readonly step: string;
  readonly passed: boolean;
  readonly output: string;
  readonly tookMs: number;
}
