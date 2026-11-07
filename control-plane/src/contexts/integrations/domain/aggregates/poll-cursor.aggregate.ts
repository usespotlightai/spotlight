import { InvalidCursorTransitionError } from '@integrations/domain/exceptions/invalid-cursor-transition.error';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { Poll } from '@integrations/domain/value-objects/poll.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface State {
  readonly teamId: TeamId;
  readonly integration: IntegrationKey;
  readonly cursor: string | null;
  readonly polledAt: Date | null;
  readonly version: number;
}

export class PollCursor {
  private constructor(private readonly state: State) {}

  static start(teamId: TeamId, integration: IntegrationKey): PollCursor {
    return new PollCursor({
      teamId,
      integration,
      cursor: null,
      polledAt: null,
      version: 0,
    });
  }

  static rehydrate(state: State): PollCursor {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InconsistentStateError(
        'poll cursor',
        `has an impossible version (${state.version})`,
      );
    }

    return new PollCursor(state);
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get integration(): IntegrationKey {
    return this.state.integration;
  }

  get cursor(): string | null {
    return this.state.cursor;
  }

  get polledAt(): Date | null {
    return this.state.polledAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  isDue(poll: Poll, now: Date): boolean {
    return poll.isDue(this.state.polledAt, now);
  }

  claimed(poll: Poll, now: Date): PollCursor {
    if (!this.isDue(poll, now)) {
      throw new InvalidCursorTransitionError(
        `The poll of ${this.state.integration.value} is not due`,
      );
    }

    return new PollCursor({ ...this.state, polledAt: now });
  }

  advancedTo(cursor: string | null): PollCursor {
    if (this.state.polledAt === null) {
      throw new InvalidCursorTransitionError(
        `The poll of ${this.state.integration.value} moves its cursor only after a poll`,
      );
    }

    return new PollCursor({ ...this.state, cursor });
  }
}
