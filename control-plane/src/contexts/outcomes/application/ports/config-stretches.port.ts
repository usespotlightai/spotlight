export const CONFIG_STRETCHES = Symbol('CONFIG_STRETCHES');

export interface PublishedStretchStart {
  readonly runId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly changedAt: Date;
}

export interface PublishedStretchBound {
  readonly stationId: string;
  readonly from: Date;
}

export interface ConfigStretchesPort {
  stretchStarts(
    teamId: string,
    bounds: readonly PublishedStretchBound[],
  ): Promise<readonly PublishedStretchStart[]>;
}
