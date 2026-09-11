import type { SettleOnConnection } from '@application/events/handlers/settle-on-connection.handler';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { FactoryProvisioningPort } from '@application/ports/factory-provisioning.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { RunnerRevocationPort } from '@application/ports/runner-revocation.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { RunOutcomes } from '@application/services/run-outcomes';
import { ConfigurationMoveStarted } from '@domain/events/configuration-move-started.event';
import { ConfigurationMoved } from '@domain/events/configuration-moved.event';
import type { DomainEvent } from '@domain/events/domain-event';
import { HostConnected } from '@domain/events/host-connected.event';
import { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import { RunStopRequested } from '@domain/events/run-stop-requested.event';
import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import { TaskFinished } from '@domain/events/task-finished.event';
import { TeamCreated } from '@domain/events/team-created.event';
import { WorkspaceConnected } from '@domain/events/workspace-connected.event';

// Each event is handled in its own transaction; a handler that throws is logged and passed over, not retried.
export class RoutingDispatcher implements DomainEventDispatcher {
  constructor(
    private readonly outcomes: RunOutcomes,
    private readonly provisioning: FactoryProvisioningPort,
    private readonly revocation: RunnerRevocationPort,
    private readonly settling: SettleOnConnection,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      try {
        await this.transaction.run(() => this.route(event));
      } catch (error) {
        this.logger.error(
          { err: error, event: event.kind },
          'Handling a domain event',
        );
      }
    }
  }

  private async route(event: DomainEvent): Promise<void> {
    // Its kind is its identity; the union narrows it back to a typed event.
    const known = event as Routable;

    switch (known.kind) {
      case 'run.completed':
        return this.outcomes.onRunCompleted(known);
      case 'run.abandoned':
        return this.outcomes.onRunAbandoned(known);
      case 'team.created':
        return this.provisioning.onTeamCreated(known);
      case 'workspace.connected':
        return this.settling.onWorkspaceConnected(known);
      case 'runner.revoked':
        return this.revocation.onRunnerRevoked(known);
      case 'task.finished':
        // No subscriber yet; recorded for the trail only.
        this.logger.debug({ event: known.kind }, 'A task finished');
        return;
      case 'run.stop_requested':
        // No subscriber; the runner acts on it by asking, not by being told.
        this.logger.debug({ event: known.kind }, 'A run was asked to stop');
        return;
      case 'host.connected':
        // No subscriber yet; recorded for the trail only.
        this.logger.debug({ event: known.kind }, 'A host was connected');
        return;
      case 'team.configuration-move-started':
        // No subscriber yet; recorded for the trail only.
        this.logger.debug(
          { event: known.kind, teamId: known.teamId.value },
          'A team started moving its configuration',
        );
        return;
      case 'team.configuration-moved':
        // No subscriber yet; recorded for the trail only.
        this.logger.debug(
          { event: known.kind, teamId: known.teamId.value },
          'A team’s configuration moved',
        );
        return;
      default:
        this.logger.warn(
          { event: event.kind },
          'A domain event has nobody to answer it',
        );
    }
  }
}

type Routable =
  | RunCompleted
  | RunAbandoned
  | RunStopRequested
  | TeamCreated
  | WorkspaceConnected
  | HostConnected
  | RunnerRevoked
  | TaskFinished
  | ConfigurationMoveStarted
  | ConfigurationMoved;
