export const LINE_REDEFINED = 'work.line-redefined.v1';

export type LineRedefinedIntegrationEvent = {
  readonly kind: typeof LINE_REDEFINED;
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationIds: readonly string[];
};
