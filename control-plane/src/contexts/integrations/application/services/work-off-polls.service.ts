import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationCursorsPort } from '@integrations/application/ports/integration-cursors.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { Poll } from '@integrations/domain/value-objects/poll.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';

export class WorkOffPolls {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly teams: TeamDirectoryPort,
    private readonly reach: HostReach,
    private readonly cursors: IntegrationCursorsPort,
    private readonly reactions: HappeningReactionsPort,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async workOff(): Promise<void> {
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
    const source = integration.source.value;
    const state = await this.cursors.read(teamId, source);

    if (!poll.isDue(state.ranAt, now)) {
      return;
    }

    const team = await this.teams.find(teamId);

    if (!team) {
      return;
    }

    if (!(await this.cursors.claimTurn(teamId, source, state, now))) {
      return;
    }

    try {
      const polled = await this.runtime.poll(
        definitions,
        integration,
        state.cursor,
        await this.reach.of(teamId, integration),
      );

      if (polled.kind === 'refused') {
        this.log.warn(
          { team: teamId.value, source, refusal: polled.refusal },
          'A host refused a poll',
        );
        return;
      }

      await this.reactions.react(
        team.workspaceId,
        teamId,
        polled.happenings,
        polled.cursor === null
          ? null
          : `poll:${source}:${teamId.value}:${state.cursor ?? ''}`,
      );

      if (!(await this.cursors.advance(teamId, source, polled.cursor, now))) {
        this.log.warn(
          { team: teamId.value, source },
          'A later poll took the turn before this one kept its cursor',
        );
      }
    } catch (error) {
      this.log.warn(
        { err: error, team: teamId.value, source },
        'Polling a host',
      );
    }
  }
}
