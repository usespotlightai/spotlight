import type { AlertInboxRequestsPort } from '@insights/application/ports/alert-inbox-requests.port';
import type { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import type { StationAlertReopened } from '@insights/domain/events/station-alert-reopened.event';
import type { StationAlertResolved } from '@insights/domain/events/station-alert-resolved.event';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';

type AlertMoved =
  | StationAlertFired
  | StationAlertResolved
  | StationAlertReopened;

export class AlertInbox {
  constructor(
    private readonly inboxRequests: AlertInboxRequestsPort,
    private readonly alertStates: StationAlertStateRepository,
  ) {}

  async moved(event: AlertMoved): Promise<void> {
    const firing = (await this.alertStates.ofAlert(event.alertId))?.firing(
      event.alertId,
    );

    if (!firing) {
      return;
    }

    await (firing.open
      ? this.inboxRequests.open(firing.taskId, firing.id)
      : this.inboxRequests.resolve(firing.taskId, firing.id));
  }
}
