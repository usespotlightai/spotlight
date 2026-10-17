import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationCursorsPort } from '@integrations/application/ports/integration-cursors.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RunSchedules {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly reach: HostReach,
    private readonly cursors: IntegrationCursorsPort,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async runDue(): Promise<void> {
    const now = this.clock.now();

    for (const applied of await this.defined.everywhere()) {
      const definitions = applied.integrations;

      for (const integration of this.runtime.integrations(definitions)) {
        if (integration.schedule) {
          await this.one(
            applied.teamId,
            definitions,
            integration,
            integration.schedule,
            now,
          );
        }
      }
    }
  }

  private async one(
    teamId: TeamId,
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    schedule: Schedule,
    now: Date,
  ): Promise<void> {
    const key = `${integration.source.value}:schedule`;
    const state = await this.cursors.read(teamId, key);
    const turn = schedule.turn(state.ranAt, now);

    if (turn === 'waits') {
      return;
    }

    if (!(await this.cursors.claimTurn(teamId, key, state, now))) {
      return;
    }

    if (turn === 'starts') {
      return;
    }

    try {
      const acted = await this.runtime.runSchedule(
        definitions,
        integration,
        await this.reach.of(teamId, integration),
      );

      if (acted.kind === 'failed') {
        this.log.warn(
          {
            team: teamId.value,
            source: integration.source.value,
            error: acted.error,
          },
          'A scheduled action failed',
        );
      }
    } catch (error) {
      this.log.warn(
        { err: error, team: teamId.value, source: key },
        'Running a schedule',
      );
    }
  }
}
