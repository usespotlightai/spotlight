interface RunLinkDto {
  readonly runId: string;
  readonly teamId: string;
}

type ShownTitleDto =
  | {
      readonly title: string;
      readonly hiddenReason: null;
      readonly link: RunLinkDto | null;
    }
  | {
      readonly title: null;
      readonly hiddenReason: string;
      readonly link: null;
    };

export type LeasedRunDto = {
  readonly id: string;
  readonly state: string;
  readonly kind: string;
  readonly teamId: string | null;
} & ShownTitleDto;

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
