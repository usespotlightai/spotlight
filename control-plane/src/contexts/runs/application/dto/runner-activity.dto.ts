export interface LeasedRunDto {
  readonly id: string;
  readonly state: string;
  readonly kind: string;
  readonly teamId: string | null;
  readonly readable: boolean;
  readonly title: string | null;
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
