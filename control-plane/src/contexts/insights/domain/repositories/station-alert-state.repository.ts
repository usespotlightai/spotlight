import type { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface StationAlertStateRepository extends ScopedRemoval<StationAlertState> {
  add(alertState: StationAlertState): Promise<void>;

  save(alertState: StationAlertState): Promise<void>;

  of(stationId: StationId): Promise<StationAlertState | null>;

  ofAlert(alertId: AlertId): Promise<StationAlertState | null>;
}
