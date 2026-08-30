export interface ActiveRunDto {
  readonly id: string;
  readonly state: string;
}

export interface ConnectedRunnerDto {
  readonly id: string;
  readonly name: string;
  readonly harnesses: readonly string[];
  readonly registeredAt: string;
  readonly lastSeenAt: string | null;
  readonly revokedAt: string | null;
  readonly connected: boolean;
  readonly currentRun: ActiveRunDto | null;
}
