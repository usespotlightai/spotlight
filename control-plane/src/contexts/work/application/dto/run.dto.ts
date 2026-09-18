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
