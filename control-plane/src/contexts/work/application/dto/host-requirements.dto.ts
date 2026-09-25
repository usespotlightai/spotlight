import type { HarnessDto } from '@work/application/dto/harness.dto';

export interface HostRequirementsDto {
  readonly runnerAtLeast: string;
  readonly harnesses: readonly HarnessDto[];
  readonly images: readonly string[];
}
