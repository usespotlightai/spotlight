interface RunLinkDto {
  readonly runId: string;
  readonly teamId: string;
}

export interface LeasedRunDto {
  readonly id: string;
  readonly state: string;
  readonly kind: string;
  readonly teamId: string | null;
  readonly title: string | null;
  readonly hiddenReason: string | null;
  readonly link: RunLinkDto | null;
}

interface BusyRunnerDto {
  readonly runnerId: string;
  readonly currentRun: LeasedRunDto;
}

interface WorkingCopyDto {
  readonly workingCopyKey: string;
  readonly lastRun: LeasedRunDto;
}

export interface RunnerActivityDto {
  readonly runners: readonly BusyRunnerDto[];
  readonly workingCopies: readonly WorkingCopyDto[];
}
