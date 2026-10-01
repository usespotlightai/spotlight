import type { AlertAsidesPort } from '@outcomes/application/ports/alert-asides.port';
import type { StationAlertRaised } from '@outcomes/domain/events/station-alert-raised.event';
import type { StationAlertRecovered } from '@outcomes/domain/events/station-alert-recovered.event';
import type { StationAlertReopened } from '@outcomes/domain/events/station-alert-reopened.event';
import type { StationWatchRepository } from '@outcomes/domain/repositories/station-watch.repository';

type AlertMoved =
  | StationAlertRaised
  | StationAlertRecovered
  | StationAlertReopened;

export class AlertInbox {
  constructor(
    private readonly asides: AlertAsidesPort,
    private readonly watches: StationWatchRepository,
  ) {}

  async moved(event: AlertMoved): Promise<void> {
    const crossing = (await this.watches.raising(event.alertId))?.crossing(
      event.alertId,
    );

    if (!crossing) {
      return;
    }

    await (crossing.open
      ? this.asides.open(crossing.taskId, crossing.id)
      : this.asides.settle(crossing.taskId, crossing.id));
  }
}
