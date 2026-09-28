export const RUN_GRANTS = Symbol('RUN_GRANTS');

export interface RunHoldDto {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
}

export interface RunGrantsPort {
  holdLost(hold: RunHoldDto): Promise<void>;

  endedFor(hold: RunHoldDto): Promise<void>;
}
