import type { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';

export const LINE_SETTINGS = Symbol('LINE_SETTINGS');

export interface LineSettingsPort {
  alertsAt(stationId: string): Promise<readonly AlertRule[] | null>;

  teamRepositories(teamId: string): Promise<readonly string[]>;
}
