import type { ScheduleCursor } from '@integrations/domain/aggregates/schedule-cursor.aggregate';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SCHEDULE_CURSORS = Symbol('SCHEDULE_CURSORS');

export interface ScheduleCursorRepository {
  of(teamId: TeamId, integration: IntegrationKey): Promise<ScheduleCursor>;

  save(cursor: ScheduleCursor): Promise<void>;
}
