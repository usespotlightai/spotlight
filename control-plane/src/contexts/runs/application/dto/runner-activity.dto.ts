export interface LeasedRunDto {
  readonly id: string;
  readonly state: string;
  readonly kind: string;
  readonly teamId: string | null;
  readonly readable: boolean;
  readonly title: string | null;
}

export interface RunnerActivityDto {
  readonly runnerId: string;
  readonly currentRun: LeasedRunDto;
}
