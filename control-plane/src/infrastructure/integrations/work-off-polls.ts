import type { ClockPort } from '@application/ports/clock.port';
import type { HappeningReactionsPort } from '@application/ports/happening-reactions.port';
import type { IntegrationCursorsPort } from '@application/ports/integration-cursors.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { bound, reads } from '@infrastructure/integrations/expression';
import { readEvents } from '@infrastructure/integrations/happenings';
import type {
  PollIR,
  ReadableIntegration,
} from '@infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import type { HttpOutbound } from '@infrastructure/outbound/http-outbound';

export class WorkOffPolls {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReader,
    private readonly factories: FactoryRepository,
    private readonly secrets: TeamSecretsPort,
    private readonly cursors: IntegrationCursorsPort,
    private readonly outbound: HttpOutbound,
    private readonly oauth2: OAuth2Access,
    private readonly reactions: HappeningReactionsPort,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async workOff(): Promise<void> {
    const now = this.clock.now();

    for (const applied of await this.configurations.all()) {
      const readables = this.reader
        .readable(applied.under(INTEGRATIONS_UNDER))
        .integrations.filter((each) => each.poll);

      for (const readable of readables) {
        if (readable.poll) {
          await this.one(applied.teamId, readable, readable.poll, now);
        }
      }
    }
  }

  private async one(
    teamId: TeamId,
    readable: ReadableIntegration,
    poll: PollIR,
    now: Date,
  ): Promise<void> {
    const source = readable.integration.source.value;
    const state = await this.cursors.read(teamId, source);

    const since = state.ranAt ? now.getTime() - state.ranAt.getTime() : null;

    if (since !== null && since < poll.every * 1000) {
      return;
    }

    const factory = await this.factories.ofTeam(teamId);

    if (!factory) {
      return;
    }

    // Mark the poll run even on error, so a failing host is not retried every tick.
    let cursor = state.cursor;

    try {
      cursor = await this.polled(teamId, readable, poll, state.cursor, factory);
    } catch (error) {
      this.log.warn(
        { err: error, team: teamId.value, source },
        'Polling a host',
      );
    }

    await this.cursors.saved(teamId, source, cursor, now);
  }

  private async polled(
    teamId: TeamId,
    readable: ReadableIntegration,
    poll: PollIR,
    cursor: string | null,
    factory: Factory,
  ): Promise<string | null> {
    const secret = await this.resolved(readable, teamId);
    const connection =
      poll.request.auth?.kind === 'oauth2'
        ? await this.oauth2.token(teamId, readable)
        : null;
    const result = await this.outbound.run(poll.request, {
      cursor: cursor ?? '',
      secret,
      ...(connection ? { connection } : {}),
    });

    if (!result.ok) {
      this.log.warn(
        { team: teamId.value, source: readable.integration.source.value },
        'A host refused a poll',
      );
      return cursor;
    }

    const against = { body: bound(result.response), cursor: cursor ?? '' };

    const happenings = await readEvents(
      poll.events,
      (happening) =>
        readable.integration.declares.find(
          (each) => each.happening.value === happening,
        ) ?? null,
      against,
      () => false,
    );

    await this.reactions.react(factory.workspaceId, teamId.value, happenings);

    return poll.cursor ? reads(poll.cursor, against) : cursor;
  }

  private async resolved(
    readable: ReadableIntegration,
    teamId: TeamId,
  ): Promise<Record<string, string>> {
    return {
      ...(await this.secrets.resolveAll(
        teamId,
        readable.integration.credentials,
      )),
    };
  }
}
