import type { HarnessDto } from '@work/application/dto/harness.dto';

export interface HostRequirementsDto {
  readonly runnerMinimum: string;
  readonly harnesses: readonly HarnessDto[];
  readonly images: readonly string[];
}
