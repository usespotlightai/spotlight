export interface RegisteredRunnerDto {
  readonly runnerId: string;
}

export interface ClaimedRunDto {
  readonly id: string;
  readonly spec: unknown;
}

export interface EnqueuedRunDto {
  readonly id: string;
  readonly harness: string;
  readonly state: string;
  readonly targetRunnerId: string | null;
}

export interface EnrolledRunnerDto {
  readonly runnerId: string;
  readonly name: string;
  readonly token: string;
}
