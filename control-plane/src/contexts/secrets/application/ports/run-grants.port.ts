export const RUN_GRANTS = Symbol('RUN_GRANTS');

export interface RunLeaseDto {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
}

export interface RunGrantsPort {
  leaseLost(lease: RunLeaseDto): Promise<void>;

  endedFor(lease: RunLeaseDto): Promise<void>;
}
