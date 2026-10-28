export const STATION_ALERT_FIRED = 'insights.station-alert-fired.v1';

export type StationAlertFiredIntegrationEvent = {
  readonly kind: typeof STATION_ALERT_FIRED;
  readonly alertId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationId: string;
};
