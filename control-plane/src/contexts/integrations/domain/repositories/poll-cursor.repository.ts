import type { PollCursor } from '@integrations/domain/aggregates/poll-cursor.aggregate';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const POLL_CURSORS = Symbol('POLL_CURSORS');

export interface PollCursorRepository {
  of(teamId: TeamId, integration: IntegrationKey): Promise<PollCursor>;

  save(cursor: PollCursor): Promise<void>;
}
