import type { CheckedStepDto } from '@change-review/application/dto/change-stack-check.dto';

export class RecordChangeStackCheckCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly stackId: string,
    readonly skipped: { code: string; detail: string | null } | null,
    readonly steps: readonly CheckedStepDto[],
  ) {}
}
