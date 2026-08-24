export interface RegisteredRunnerDto {
  readonly runnerId: string;
}

export interface ClaimedRunDto {
  readonly id: string;
  readonly spec: unknown;
  readonly leaseExpiresAt: string;
}

export interface EnqueuedRunDto {
  readonly id: string;
  readonly pool: string;
  readonly state: string;
  readonly targetRunnerId: string | null;
}
