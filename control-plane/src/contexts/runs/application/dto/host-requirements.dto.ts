import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import type { HarnessDto } from '@runs/application/dto/harness.dto';

export interface HostRequirementsDto {
  readonly hostRelease: string | null;
  readonly hostMinimum: string;
  readonly runnerMinimum: string;
  readonly harnesses: readonly HarnessDto[];
  readonly images: readonly string[];
  readonly harnessKeys: readonly string[];
  readonly workingCopies: WorkingCopyStoreContract | null;
}
