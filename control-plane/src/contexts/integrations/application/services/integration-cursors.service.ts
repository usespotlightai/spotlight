import type { PollCursorRepository } from '@integrations/domain/repositories/poll-cursor.repository';
import type { ScheduleCursorRepository } from '@integrations/domain/repositories/schedule-cursor.repository';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class IntegrationCursors {
  constructor(
    private readonly polls: PollCursorRepository,
    private readonly schedules: ScheduleCursorRepository,
  ) {}

  async removePollCursorOf(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<void> {
    const cursor = await this.polls.of(teamId, integration);

    if (!cursor.isNew) {
      await this.polls.remove(cursor);
    }
  }

  async removeScheduleCursorOf(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<void> {
    const cursor = await this.schedules.of(teamId, integration);

    if (!cursor.isNew) {
      await this.schedules.remove(cursor);
    }
  }

  async removePollCursorsOfTeam(teamId: TeamId): Promise<void> {
    for (const cursor of await this.polls.ofTeam(teamId)) {
      await this.polls.remove(cursor);
    }
  }

  async removeScheduleCursorsOfTeam(teamId: TeamId): Promise<void> {
    for (const cursor of await this.schedules.ofTeam(teamId)) {
      await this.schedules.remove(cursor);
    }
  }
}
