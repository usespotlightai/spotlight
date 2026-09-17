export interface HeldRunDto {
  readonly id: string;
  readonly state: string;
}

export interface RunnerActivityDto {
  readonly runnerId: string;
  readonly currentRun: HeldRunDto;
}
