import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { ScheduleCursorVersionConflictError } from '@integrations/domain/exceptions/schedule-cursor-version-conflict.error';
import type { ScheduleCursorRepository } from '@integrations/domain/repositories/schedule-cursor.repository';
import type { CronCalendar } from '@integrations/domain/services/cron-calendar';
import type { Integration } from '@integrations/domain/value-objects/integration.vo';
import type { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RunSchedules {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly cursors: ScheduleCursorRepository,
    private readonly calendar: CronCalendar,
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
    const cursor = await this.cursors.of(teamId, integration.key);
    const turn = cursor.turn(schedule, now, this.calendar);

    if (turn === 'waits') {
      return;
    }

    try {
      await this.cursors.save(cursor.claimed(schedule, now, this.calendar));
    } catch (error) {
      if (error instanceof ScheduleCursorVersionConflictError) {
        return;
      }

      throw error;
    }

    if (turn === 'starts') {
      return;
    }

    try {
      const acted = await this.runtime.runSchedule(
        definitions,
        integration,
        await this.callAuthResolver.of(teamId, integration),
      );

      if (acted.kind === 'failed') {
        this.log.warn(
          {
            team: teamId.value,
            integration: integration.key.value,
            error: acted.error,
          },
          'A scheduled action failed',
        );
      }
    } catch (error) {
      this.log.warn(
        { err: error, team: teamId.value, integration: integration.key.value },
        'Running a schedule',
      );
    }
  }
}
