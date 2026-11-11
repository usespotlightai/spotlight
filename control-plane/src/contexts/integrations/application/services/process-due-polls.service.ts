import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import type { DeliveryReactionsPort } from '@integrations/application/ports/delivery-reactions.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { PollCursor } from '@integrations/domain/aggregates/poll-cursor.aggregate';
import { PollCursorVersionConflictError } from '@integrations/domain/exceptions/poll-cursor-version-conflict.error';
import type { PollCursorRepository } from '@integrations/domain/repositories/poll-cursor.repository';
import type { Integration } from '@integrations/domain/value-objects/integration.vo';
import type { Poll } from '@integrations/domain/value-objects/poll.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { OncePer } from '@shared-kernel/application/services/once-per';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const SKIPPED_FOR_MS = 10 * 60_000;

export class ProcessDuePolls {
  readonly #skipped = new OncePer(SKIPPED_FOR_MS);

  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly teams: TeamDirectoryPort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly cursors: PollCursorRepository,
    private readonly reactions: DeliveryReactionsPort,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    for (const applied of await this.defined.everywhere()) {
      const definitions = applied.integrations;

      for (const integration of this.runtime.integrations(definitions)) {
        if (integration.poll) {
          await this.one(
            applied.teamId,
            definitions,
            integration,
            integration.poll,
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
    poll: Poll,
    now: Date,
  ): Promise<void> {
    const integrationKey = integration.key.value;
    const cursor = await this.cursors.of(teamId, integration.key);

    if (!cursor.isDue(poll, now)) {
      return;
    }

    const team = await this.teams.find(teamId);

    if (!team) {
      if (this.#skipped.due(`${teamId.value}\n${integrationKey}`, now)) {
        this.log.warn(
          {
            teamId: teamId.value,
            integration: integrationKey,
            reason: 'team-not-found',
          },
          'Skipped a poll',
        );
      }
      return;
    }

    const held = await this.claimed(cursor, poll, now);

    if (!held) {
      return;
    }

    try {
      const polled = await this.runtime.poll(
        definitions,
        integration,
        held.cursor,
        await this.callAuthResolver.of(teamId, integration),
      );

      if (polled.kind === 'failed') {
        this.log.warn(
          {
            team: teamId.value,
            integration: integrationKey,
            error: polled.error,
          },
          'A service answered a poll with an error',
        );
        return;
      }

      const failure = await this.reactions.react(
        team.workspaceId,
        teamId,
        polled.happenings,
        held.happeningsKeyFor(polled.cursor),
      );

      if (failure) {
        this.log.warn(
          {
            team: teamId.value,
            integration: integrationKey,
            transient: failure.transient,
            error: failure.reason,
          },
          'Work could not react to what a poll found',
        );
        return;
      }

      await this.advanced(held, polled.cursor);
    } catch (error) {
      this.log.warn(
        { err: error, team: teamId.value, integration: integrationKey },
        'Polling a service',
      );
    }
  }

  private async claimed(
    cursor: PollCursor,
    poll: Poll,
    now: Date,
  ): Promise<PollCursor | null> {
    try {
      await this.cursors.save(cursor.claimed(poll, now));
    } catch (error) {
      if (error instanceof PollCursorVersionConflictError) {
        return null;
      }

      throw error;
    }

    const held = await this.cursors.of(cursor.teamId, cursor.integration);

    return held.polledAt?.getTime() === now.getTime() ? held : null;
  }

  private async advanced(held: PollCursor, to: string | null): Promise<void> {
    try {
      await this.cursors.save(held.advancedTo(to));
    } catch (error) {
      if (!(error instanceof PollCursorVersionConflictError)) {
        throw error;
      }

      this.log.warn(
        { team: held.teamId.value, integration: held.integration.value },
        'A later poll got the turn before this one stored its cursor',
      );
    }
  }
}
