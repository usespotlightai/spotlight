import { InvalidCursorTransitionError } from '@integrations/domain/exceptions/invalid-cursor-transition.error';
import type { CronCalendar } from '@integrations/domain/services/cron-calendar';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type {
  Schedule,
  ScheduleTurn,
} from '@integrations/domain/value-objects/schedule.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface State {
  readonly teamId: TeamId;
  readonly integration: IntegrationKey;
  readonly ranAt: Date | null;
  readonly version: number;
}

export class ScheduleCursor {
  private constructor(private readonly state: State) {}

  static start(teamId: TeamId, integration: IntegrationKey): ScheduleCursor {
    return new ScheduleCursor({
      teamId,
      integration,
      ranAt: null,
      version: 0,
    });
  }

  static rehydrate(state: State): ScheduleCursor {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InconsistentStateError(
        'schedule cursor',
        `has an impossible version (${state.version})`,
      );
    }

    if (state.ranAt === null) {
      throw new InconsistentStateError(
        'schedule cursor',
        'was stored without the time it ran',
      );
    }

    return new ScheduleCursor(state);
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get integration(): IntegrationKey {
    return this.state.integration;
  }

  get ranAt(): Date | null {
    return this.state.ranAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  turn(schedule: Schedule, now: Date, calendar: CronCalendar): ScheduleTurn {
    return schedule.turn(this.state.ranAt, now, calendar);
  }

  claimed(
    schedule: Schedule,
    now: Date,
    calendar: CronCalendar,
  ): ScheduleCursor {
    if (this.turn(schedule, now, calendar) === 'waits') {
      throw new InvalidCursorTransitionError(
        `The schedule of ${this.state.integration.value} is not due`,
      );
    }

    return new ScheduleCursor({ ...this.state, ranAt: now });
  }
}
