export interface ActiveRunDto {
  readonly id: string;
  readonly state: string;
}

export interface ConnectedRunnerDto {
  readonly id: string;
  readonly pool: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly registeredAt: string;
  readonly lastSeenAt: string;
  readonly connected: boolean;
  readonly currentRun: ActiveRunDto | null;
}
