import type { SeedOnConnection } from '@application/events/handlers/seed-on-connection.handler';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { FactoryProvisioningPort } from '@application/ports/factory-provisioning.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { RunnerRevocationPort } from '@application/ports/runner-revocation.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { RunOutcomes } from '@application/services/run-outcomes';
import type { DomainEvent } from '@domain/events/domain-event';
import { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
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
    private readonly seeding: SeedOnConnection,
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
    if (event instanceof RunCompleted) {
      return this.outcomes.onRunCompleted(event);
    }
    if (event instanceof RunAbandoned) {
      return this.outcomes.onRunAbandoned(event);
    }
    if (event instanceof TeamCreated) {
      return this.provisioning.onTeamCreated(event);
    }
    if (event instanceof WorkspaceConnected) {
      return this.seeding.onWorkspaceConnected(event);
    }
    if (event instanceof RunnerRevoked) {
      return this.revocation.onRunnerRevoked(event);
    }
    if (event instanceof TaskFinished) {
      // No subscriber yet; recorded for the trail only.
      this.logger.debug({ event: event.kind }, 'A task finished');

      return;
    }

    this.logger.warn(
      { event: event.kind },
      'A domain event has nobody to answer it',
    );
  }
}
