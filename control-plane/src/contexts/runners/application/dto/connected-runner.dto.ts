export interface ConnectedRunnerDto {
  readonly id: string;
  readonly name: string;
  readonly harnesses: readonly string[];
  readonly registeredAt: string;
  readonly lastSeenAt: string | null;
  readonly revokedAt: string | null;
  readonly connected: boolean;
}
