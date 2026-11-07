export const LINE_CHANGED = 'lines.line-changed.v1';

export type LineChangedIntegrationEvent = {
  readonly kind: typeof LINE_CHANGED;
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationIds: readonly string[];
};
