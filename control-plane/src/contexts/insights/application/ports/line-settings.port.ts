import type { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LINE_SETTINGS = Symbol('LINE_SETTINGS');

export interface LineSettingsPort {
  alertsAt(stationId: StationId): Promise<readonly AlertRule[] | null>;

  teamRepositories(teamId: TeamId): Promise<readonly string[]>;
}
