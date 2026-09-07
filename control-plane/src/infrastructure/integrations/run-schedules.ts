import type { ClockPort } from '@application/ports/clock.port';
import type { IntegrationCursorsPort } from '@application/ports/integration-cursors.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type {
  ReadableIntegration,
  ScheduleIR,
} from '@infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import type { HttpOutbound } from '@infrastructure/outbound/http-outbound';
import { CronTime } from 'cron';

/**
 * Runs each team's schedules: when a cron comes round, it runs the action the
 * file names, with that team's secrets. What runs and when is the file's; the
 * clock, the catching-up, and the running are generic. A schedule that has
 * fallen behind fires once and moves on — a host is not owed the deliveries it
 * slept through.
 */
export class RunSchedules {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReader,
    private readonly secrets: TeamSecretsPort,
    private readonly cursors: IntegrationCursorsPort,
    private readonly outbound: HttpOutbound,
    private readonly oauth2: OAuth2Access,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async runDue(): Promise<void> {
    const now = this.clock.now();

    for (const applied of await this.configurations.all()) {
      const readables = this.reader
        .readable(applied.under(INTEGRATIONS_UNDER))
        .integrations.filter((each) => each.schedule);

      for (const readable of readables) {
        if (readable.schedule) {
          await this.one(applied.teamId, readable, readable.schedule, now);
        }
      }
    }
  }

  private async one(
    teamId: TeamId,
    readable: ReadableIntegration,
    schedule: ScheduleIR,
    now: Date,
  ): Promise<void> {
    const key = `${readable.integration.source.value}:schedule`;
    const state = await this.cursors.read(teamId, key);

    // First sight of a schedule sets its clock going from now, so a deploy does
    // not fire every schedule at once for the time it was not watching.
    if (!state.ranAt) {
      await this.cursors.saved(teamId, key, null, now);
      return;
    }

    if (!this.due(schedule.cron, state.ranAt, now)) {
      return;
    }

    try {
      await this.fire(teamId, readable, schedule);
    } catch (error) {
      this.log.warn(
        { err: error, team: teamId.value, source: key },
        'Running a schedule',
      );
    }

    await this.cursors.saved(teamId, key, null, now);
  }

  private due(cron: string, since: Date, now: Date): boolean {
    const next = new CronTime(cron).getNextDateFrom(since).toJSDate();
    return next.getTime() <= now.getTime();
  }

  private async fire(
    teamId: TeamId,
    readable: ReadableIntegration,
    schedule: ScheduleIR,
  ): Promise<void> {
    const request = readable.actions.get(schedule.action);

    // The compiler refuses a schedule whose action is undefined, so this holds.
    if (!request) {
      return;
    }

    const secret = await this.resolved(readable, teamId);
    const connection =
      request.auth?.kind === 'oauth2'
        ? await this.oauth2.token(teamId, readable)
        : null;
    const result = await this.outbound.run(request, {
      secret,
      ...(connection ? { connection } : {}),
    });

    if (!result.ok) {
      this.log.warn(
        {
          team: teamId.value,
          source: readable.integration.source.value,
          status: result.status,
        },
        'A scheduled action was refused',
      );
    }
  }

  private async resolved(
    readable: ReadableIntegration,
    teamId: TeamId,
  ): Promise<Record<string, string>> {
    const secret: Record<string, string> = {};

    for (const name of readable.integration.credentials) {
      const value = await this.secrets.resolve(teamId, name);
      if (value !== null) {
        secret[name.value] = value;
      }
    }

    return secret;
  }
}
