export const LINE_CHANGED = 'lines.line-changed.v1';

export type LaidOutStationKind = 'backlog' | 'work' | 'completed';

export type LaidOutStation = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly kind: LaidOutStationKind;
  readonly color: string;
  readonly position: number;
};

export type LineChangedIntegrationEvent = {
  readonly kind: typeof LINE_CHANGED;
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly version: number;
  readonly lineKey: string;
  readonly lineName: string;
  readonly deleted: boolean;
  readonly stations: readonly LaidOutStation[];
  readonly stationIds: readonly string[];
};
