export interface CheckedStepDto {
  readonly step: string;
  readonly passed: boolean;
  readonly output: string;
  readonly tookMs: number;
}
