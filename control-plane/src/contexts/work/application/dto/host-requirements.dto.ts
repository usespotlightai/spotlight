import type { HarnessDto } from '@work/application/dto/harness.dto';

export interface HostRequirementsDto {
  readonly hostRelease: string | null;
  readonly hostMinimum: string;
  readonly runnerMinimum: string;
  readonly harnesses: readonly HarnessDto[];
  readonly images: readonly string[];
}
